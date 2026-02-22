"""
HelioScope AI — FastAPI Main Application
Renewable Energy Placement Intelligence Platform
"""

import os
import asyncio
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session

from models import (
    LocationRequest,
    PlacementScoreResponse,
    ROIRequest,
    ROIResponse,
    SummaryRequest,
    SummaryResponse,
    HealthResponse,
    AnalyzeRequest,
    AnalyzeResponse,
)
from scoring import calculate_score
from roi import calculate_roi
from solar_service import fetch_solar_irradiance
from wind_service import fetch_weather, fetch_wind_speed
from elevation_service import fetch_elevation_and_slope, fetch_elevation
from llm_service import generate_summary
from database import init_db, get_db, save_analysis
from scoring import calculate_score, get_calibrator
from auth import (
    create_access_token, create_user, authenticate_user,
    get_current_user, require_auth, require_pro, require_enterprise,
    check_free_quota, increment_usage, get_usage_this_month,
    FREE_QUOTA,
)
from user_db import User, BillingRecord, SubscriptionTier
import energy_dashboard as ed
from heatmap_service import compute_heatmap
from seasonal_service import fetch_monthly_irradiance
from nationwide_heatmap import compute_nationwide_heatmap
from roi import calculate_tariff_sensitivity
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Tuple

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# ── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("\u2705 HelioScope AI Backend starting up...")
    init_db()   # Connect to PostgreSQL and create tables
    # Bootstrap adaptive calibrator from historical DB analyses
    try:
        from database import SessionLocal
        with SessionLocal() as _db:
            get_calibrator().load_from_db(_db)
    except Exception as _e:
        logger.warning(f"Calibrator bootstrap skipped: {_e}")
    yield
    logger.info("\ud83d\uded1 HelioScope AI Backend shutting down...")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="HelioScope AI API",
    description="Renewable Energy Placement Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost:80,http://localhost:8000,http://127.0.0.1:5176"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # lock down in production via env
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Grid Distance Estimator (used in /api/analyze pipeline) ───────────────────
def _estimate_grid_km(lat: float, lng: float) -> float:
    """Heuristic grid proximity estimate when user doesn't provide grid_distance_km."""
    if 8 <= lat <= 37 and 68 <= lng <= 97:
        if 20 <= lat <= 30: return 8.0    # Indo-Gangetic plain — dense
        if lat >= 30:       return 20.0   # Himalayan foothills — sparse
        return 10.0                       # Southern India
    if 35 <= lat <= 72 and -10 <= lng <= 40: return 5.0    # Europe — excellent
    if 25 <= lat <= 60 and -130 <= lng <= -60: return 12.0  # North America
    if -35 <= lat <= 37 and -18 <= lng <= 52: return 25.0   # Africa / remote
    return 15.0  # Global default


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/api/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Health check endpoint for load balancer / Kubernetes probes."""
    return HealthResponse(
        status="healthy",
        version="2.0.0",
        services={
            "scoring_engine": "v3-production",
            "roi_engine": "v2-plant-size",
            "gemini": "configured" if os.getenv("GEMINI_API_KEY") else "not_configured",
            "elevation_api": "google" if os.getenv("GOOGLE_ELEVATION_API_KEY") else "open-elevation",
            "database": "connected" if os.getenv("DATABASE_URL") else "stateless",
        },
    )


# =========================================================================
# ┌────────────────────────────────────────────┐
# |           UNIFIED EXECUTION PIPELINE                        |
# |  User → React → FastAPI → NASA+Open-Meteo → Algorithm →    |
# |           ROI Engine → LLM → React → User                  |
# └────────────────────────────────────────────┘
# =========================================================================
@app.post("/api/analyze", response_model=AnalyzeResponse, tags=["Pipeline"])
@limiter.limit("20/minute")
async def analyze_full_pipeline(request: Request, body: AnalyzeRequest, db: Session = Depends(get_db)):
    """
    UNIFIED PIPELINE v3 — 8-factor Gaussian-sigmoid production engine.

    Step 1 → React sends coordinates + plant_size_kw to FastAPI
    Step 2 → Concurrent fetch: NASA Solar + Open-Meteo Weather + Elevation+Slope
    Step 3 → 8-factor scoring: solar/wind/temp/elev/cloud/slope/grid/plant-size
    Step 4 → ROI Engine: capacity-first (kW × irradiance × 365)
    Step 5 → LLM generates AI explanation
    Step 6 → Return ALL results: score, confidence, ROI, sub-scores, constraints
    """
    plant_kw = body.plant_size_kw or 10.0
    logger.info(
        f"[PIPELINEv3] lat={body.lat:.4f}, lng={body.lng:.4f} "
        f"plant={plant_kw}kW grid_dist={body.grid_distance_km}km"
    )

    # ── STEP 2: Concurrent fetch (solar + weather + elevation/slope) ──────
    logger.info("[PIPELINEv3] Step 2: Fetching NASA solar + Open-Meteo weather + elevation/slope concurrently...")
    solar, weather, elev_data = await asyncio.gather(
        fetch_solar_irradiance(body.lat, body.lng),
        fetch_weather(body.lat, body.lng),
        fetch_elevation_and_slope(body.lat, body.lng),
    )
    wind        = weather["wind_speed"]
    temp_c      = weather["temperature_c"]
    humidity    = weather["humidity_pct"]
    cloud_pct   = weather["cloud_cover_pct"]
    data_src    = weather.get("data_sources", 3)
    elevation   = elev_data["elevation"]
    slope_deg   = elev_data["slope_degrees"]
    grid_km     = body.grid_distance_km if body.grid_distance_km is not None else _estimate_grid_km(body.lat, body.lng)
    avail_m2    = body.available_area_m2 or (plant_kw * 8 * 2)  # generous default

    logger.info(
        f"[PIPELINEv3] solar={solar:.3f} wind={wind:.1f} elev={elevation:.0f}m "
        f"temp={temp_c:.1f}°C hum={humidity:.0f}% cloud={cloud_pct:.0f}% "
        f"slope={slope_deg:.1f}° grid={grid_km:.0f}km plant={plant_kw}kW"
    )

    # ── STEP 3: 8-factor scoring engine v3 ────────────────────────────────
    logger.info("[PIPELINEv3] Step 3: Running 8-factor Gaussian+sigmoid scoring engine v3...")
    score_result = calculate_score(
        solar_irradiance=solar,
        wind_speed=wind,
        elevation=elevation,
        temperature=temp_c,
        humidity=humidity,
        lat=body.lat,
        cloud_cover_pct=cloud_pct,
        slope_degrees=slope_deg,
        grid_distance_km=grid_km,
        plant_size_kw=plant_kw,
        available_area_m2=avail_m2,
        data_sources=data_src,
    )
    logger.info(
        f"[PIPELINEv3] Score={score_result['score']}/100 Grade={score_result['grade']} "
        f"Confidence={score_result['confidence']}% "
        f"Suitability={score_result['suitability_class']} "
        f"Adj={score_result['calibration_adjustment']:+.1f} "
        f"Violations={len(score_result['constraint_violations'])}"
    )

    # ── STEP 4: ROI Engine — capacity-first ────────────────────────────────
    logger.info("[PIPELINEv3] Step 4: ROI engine (capacity-first, plant_size_kw mode)...")
    roi_result = calculate_roi(
        solar_irradiance=solar,
        panel_area=body.panel_area,
        efficiency=body.efficiency,
        electricity_rate=body.electricity_rate,
        installation_cost=body.installation_cost if body.installation_cost > 0 else None,
        plant_size_kw=plant_kw,
    )
    logger.info(
        f"[PIPELINEv3] ROI: {roi_result['system_size_kwp']:.1f}kWp "
        f"area={roi_result['required_land_area_m2']:.0f}m² "
        f"cost=₹{roi_result['installation_cost_inr']:,.0f} "
        f"payback={roi_result['payback_years']}yr "
        f"annual=₹{roi_result['annual_savings_inr']:,.0f}"
    )

    # ── STEP 5: LLM AI explanation ─────────────────────────────────────────
    logger.info("[PIPELINEv3] Step 5: LLM generating AI explanation...")
    summary_result = await generate_summary(
        score=score_result["score"],
        roi_years=roi_result["payback_years"],
        lat=body.lat,
        lng=body.lng,
        solar_irradiance=solar,
        wind_speed=wind,
        elevation=elevation,
        annual_savings=roi_result["annual_savings_inr"],
    )

    # ── Persist to DB ──────────────────────────────────────────────────────
    save_analysis(db, {
        "lat": body.lat, "lng": body.lng,
        "panel_area": roi_result["required_land_area_m2"],
        "efficiency": body.efficiency,
        "solar_irradiance": solar, "wind_speed": wind, "elevation": elevation,
        "score": score_result["score"], "grade": score_result["grade"],
        "solar_score": score_result["solar_score"],
        "wind_score": score_result["wind_score"],
        "elevation_score": score_result["elevation_score"],
        "recommendation": score_result["recommendation"],
        "energy_output_kwh_per_year": roi_result["energy_output_kwh_per_year"],
        "annual_savings_inr": roi_result["annual_savings_inr"],
        "payback_years": roi_result["payback_years"],
        "lifetime_profit_inr": roi_result["lifetime_profit_inr"],
        "ai_summary": summary_result["summary"],
        "ai_provider": summary_result["generated_by"],
    })

    # ── STEP 6: Return full v3 response ────────────────────────────────────
    logger.info("[PIPELINEv3] Step 6: Returning full v3 response to React.")
    return AnalyzeResponse(
        # Location
        lat=body.lat, lng=body.lng,
        # Climate
        solar_irradiance=solar, wind_speed=wind, elevation=elevation,
        temperature_c=temp_c, humidity_pct=humidity,
        cloud_cover_pct=cloud_pct, slope_degrees=slope_deg,
        # Score
        score=score_result["score"],
        grade=score_result["grade"],
        confidence=score_result["confidence"],
        suitability_class=score_result["suitability_class"],
        recommendation=score_result["recommendation"],
        constraint_violations=score_result["constraint_violations"],
        is_suitable=score_result["is_suitable"],
        # Sub-scores
        solar_score=score_result["solar_score"],
        wind_score=score_result["wind_score"],
        elevation_score=score_result["elevation_score"],
        temperature_score=score_result["temperature_score"],
        cloud_score=score_result["cloud_score"],
        slope_score=score_result["slope_score"],
        grid_score=score_result["grid_score"],
        plant_size_score=score_result["plant_size_score"],
        calibration_adjustment=score_result["calibration_adjustment"],
        algorithm_version=score_result["algorithm_version"],
        # Plant sizing
        plant_size_kw=plant_kw,
        required_land_area_m2=roi_result["required_land_area_m2"],
        system_size_kwp=roi_result["system_size_kwp"],
        installation_cost_inr=roi_result["installation_cost_inr"],
        # ROI
        energy_output_kwh_per_year=roi_result["energy_output_kwh_per_year"],
        annual_savings_inr=roi_result["annual_savings_inr"],
        monthly_savings_inr=roi_result["monthly_savings_inr"],
        daily_savings_inr=roi_result["daily_savings_inr"],
        payback_years=roi_result["payback_years"],
        lifetime_profit_inr=roi_result["lifetime_profit_inr"],
        system_lifetime_years=roi_result["system_lifetime_years"],
        subsidy_amount_inr=roi_result["subsidy_amount_inr"],
        net_cost_after_subsidy_inr=roi_result["net_cost_after_subsidy_inr"],
        payback_years_after_subsidy=roi_result["payback_years_after_subsidy"],
        lifetime_profit_after_subsidy_inr=roi_result["lifetime_profit_after_subsidy_inr"],
        # AI
        ai_summary=summary_result["summary"],
        ai_generated_by=summary_result["generated_by"],
    )



# ── Legacy individual endpoints (kept for compatibility) ──────────────────────

@app.post("/api/analyze-placement", response_model=PlacementScoreResponse, tags=["Analysis"])
@limiter.limit("30/minute")
async def analyze_placement(request: Request, body: LocationRequest, db: Session = Depends(get_db)):
    """
    Main analysis endpoint.
    1. Fetches climate data from 3 external APIs in parallel.
    2. Computes placement score using weighted algorithm.
    3. Persists result to PostgreSQL (if DB is available).
    4. Returns score, grade, and breakdown.
    """
    logger.info(f"Analyzing placement for lat={body.lat}, lng={body.lng}")

    # Fetch all climate data concurrently
    solar, wind, elevation = await asyncio.gather(
        fetch_solar_irradiance(body.lat, body.lng),
        fetch_wind_speed(body.lat, body.lng),
        fetch_elevation(body.lat, body.lng),
    )

    # Calculate placement score
    result = calculate_score(solar, wind, elevation)

    # Persist to DB (non-blocking, best-effort)
    save_analysis(db, {
        "lat": body.lat,
        "lng": body.lng,
        "panel_area": body.panel_area,
        "efficiency": body.efficiency,
        "solar_irradiance": solar,
        "wind_speed": wind,
        "elevation": elevation,
        "score": result["score"],
        "grade": result["grade"],
        "solar_score": result["solar_score"],
        "wind_score": result["wind_score"],
        "elevation_score": result["elevation_score"],
        "recommendation": result["recommendation"],
    })

    return PlacementScoreResponse(
        score=result["score"],
        grade=result["grade"],
        solar_irradiance=solar,
        wind_speed=wind,
        elevation=elevation,
        solar_score=result["solar_score"],
        wind_score=result["wind_score"],
        elevation_score=result["elevation_score"],
        lat=body.lat,
        lng=body.lng,
        recommendation=result["recommendation"],
    )


# ── ROI Calculation ───────────────────────────────────────────────────────────
@app.post("/api/calculate-roi", response_model=ROIResponse, tags=["ROI"])
@limiter.limit("30/minute")
async def calculate_roi_endpoint(request: Request, body: ROIRequest):
    """
    Calculate ROI for a solar installation based on irradiance, panel specs,
    cost, and local electricity rate.
    """
    logger.info(f"Calculating ROI: area={body.panel_area}m², efficiency={body.efficiency}")

    result = calculate_roi(
        solar_irradiance=body.solar_irradiance,
        panel_area=body.panel_area,
        efficiency=body.efficiency,
        electricity_rate=body.electricity_rate,
        installation_cost=body.installation_cost,
    )

    return ROIResponse(**result)


# ── AI Summary ────────────────────────────────────────────────────────────────
@app.post("/api/generate-summary", response_model=SummaryResponse, tags=["AI"])
@limiter.limit("20/minute")
async def generate_summary_endpoint(request: Request, body: SummaryRequest):
    """
    Generate an AI-powered placement recommendation using Google Gemini.
    Falls back to template-based response if Gemini API key is not configured.
    """
    logger.info(f"Generating summary for score={body.score}, roi={body.roi_years}")

    result = await generate_summary(
        score=body.score,
        roi_years=body.roi_years,
        lat=body.lat,
        lng=body.lng,
        solar_irradiance=body.solar_irradiance,
        wind_speed=body.wind_speed,
        elevation=body.elevation,
        annual_savings=body.annual_savings,
    )

    return SummaryResponse(**result)


# ── Error Handlers ────────────────────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error. Please try again.", "status_code": 500},
    )


# ════════════════════════════════════════════════════════════════════════════════
# AUTH ROUTES
# ════════════════════════════════════════════════════════════════════════════════

class RegisterBody(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = ""

class LoginBody(BaseModel):
    email: str
    password: str


@app.post("/api/auth/register", tags=["Auth"])
async def register(body: RegisterBody, db: Session = Depends(get_db)):
    """Create a new account (Free tier by default)."""
    if db is None:
        raise HTTPException(503, "Database unavailable.")
    user = create_user(db, body.email, body.password, body.full_name or "")
    token = create_access_token(user.id, user.email, user.tier.value)
    return {
        "token": token,
        "user": {
            "id": user.id, "email": user.email,
            "full_name": user.full_name, "tier": user.tier.value,
            "analyses_used": 0, "analyses_limit": FREE_QUOTA,
        }
    }


@app.post("/api/auth/login", tags=["Auth"])
async def login(body: LoginBody, db: Session = Depends(get_db)):
    """Authenticate and return a JWT token."""
    if db is None:
        raise HTTPException(503, "Database unavailable.")
    user = authenticate_user(db, body.email, body.password)
    token = create_access_token(user.id, user.email, user.tier.value)
    used = get_usage_this_month(db, user.id)
    return {
        "token": token,
        "user": {
            "id": user.id, "email": user.email,
            "full_name": user.full_name, "tier": user.tier.value,
            "analyses_used": used,
            "analyses_limit": FREE_QUOTA if user.tier == SubscriptionTier.free else None,
        }
    }


@app.get("/api/auth/me", tags=["Auth"])
async def get_me(
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return current user profile. Returns null if not authenticated."""
    if user is None:
        return {"user": None}
    used = get_usage_this_month(db, user.id) if db else 0
    return {
        "user": {
            "id": user.id, "email": user.email,
            "full_name": user.full_name, "tier": user.tier.value,
            "analyses_used": used,
            "analyses_limit": FREE_QUOTA if user.tier == SubscriptionTier.free else None,
        }
    }


# ── Demo Tier Switcher (for judge/hackathon demos) ────────────────────────────
class DemoTierBody(BaseModel):
    tier: str      # "free" | "pro" | "enterprise"
    demo_key: str  # simple shared secret, not full auth

DEMO_SECRET = os.getenv("DEMO_SECRET_KEY", "helioscope-demo-2026")

@app.post("/api/auth/demo-tier", tags=["Auth"])
async def switch_demo_tier(
    body: DemoTierBody,
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    🎪 DEMO MODE — instantly switch subscription tier for live demonstrations.
    Requires demo_key (shared secret) + valid JWT.
    """
    if body.demo_key != DEMO_SECRET:
        raise HTTPException(status_code=403, detail="Invalid demo key.")
    if user is None or db is None:
        raise HTTPException(status_code=401, detail="Must be logged in to switch tier.")

    valid_tiers = {"free": SubscriptionTier.free, "pro": SubscriptionTier.pro, "enterprise": SubscriptionTier.enterprise}
    new_tier = valid_tiers.get(body.tier)
    if not new_tier:
        raise HTTPException(status_code=400, detail=f"Invalid tier '{body.tier}'. Use: free/pro/enterprise")

    user.tier = new_tier
    db.commit()
    db.refresh(user)

    # Issue fresh JWT with new tier claim
    new_token = create_access_token(user.id, user.email, new_tier.value)
    logger.info(f"[DEMO] {user.email} switched to tier={new_tier.value}")
    return {
        "message": f"✅ Switched to {new_tier.value} tier",
        "access_token": new_token,
        "token_type": "bearer",
        "user": {
            "id": user.id, "email": user.email,
            "tier": new_tier.value, "full_name": user.full_name,
            "analyses_used": 0, "analyses_limit": FREE_QUOTA if new_tier == SubscriptionTier.free else None,
        }
    }


# ════════════════════════════════════════════════════════════════════════════════
# BILLING ROUTES (Razorpay)
# ════════════════════════════════════════════════════════════════════════════════

TIER_PRICES = {
    "pro":        49900,   # ₹499 × 100 paise
    "enterprise": 199900,  # ₹1,999 × 100 paise
}

class BillingOrderBody(BaseModel):
    tier: str   # "pro" | "enterprise"

class BillingVerifyBody(BaseModel):
    razorpay_order_id:   str
    razorpay_payment_id: str
    razorpay_signature:  str
    tier: str


@app.post("/api/billing/create-order", tags=["Billing"])
async def create_billing_order(
    body: BillingOrderBody,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """Create a Razorpay order for subscription upgrade."""
    if body.tier not in TIER_PRICES:
        raise HTTPException(400, "Invalid tier. Choose 'pro' or 'enterprise'.")
    amount = TIER_PRICES[body.tier]

    rzp_key = os.getenv("RAZORPAY_KEY_ID", "")
    rzp_secret = os.getenv("RAZORPAY_KEY_SECRET", "")

    order_id = f"mock_order_{user.id}_{body.tier}"
    if rzp_key and rzp_secret:
        try:
            import razorpay
            client = razorpay.Client(auth=(rzp_key, rzp_secret))
            order = client.order.create({
                "amount": amount, "currency": "INR",
                "notes": {"user_id": str(user.id), "tier": body.tier}
            })
            order_id = order["id"]
        except Exception as e:
            logger.warning(f"Razorpay order creation failed: {e}. Using mock order.")

    # Store pending billing record
    if db:
        record = BillingRecord(
            user_id=user.id,
            razorpay_order_id=order_id,
            amount_paise=amount,
            tier_granted=SubscriptionTier(body.tier),
            status="created",
        )
        db.add(record); db.commit()

    return {
        "order_id": order_id,
        "amount": amount,
        "currency": "INR",
        "key_id": rzp_key or "rzp_test_mock",
        "tier": body.tier,
    }


@app.post("/api/billing/verify", tags=["Billing"])
async def verify_billing(
    body: BillingVerifyBody,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """Verify Razorpay payment signature and upgrade user tier."""
    if db is None:
        raise HTTPException(503, "Database unavailable.")
    if body.tier not in TIER_PRICES:
        raise HTTPException(400, "Invalid tier.")

    # In mock mode or with real key, verify signature
    rzp_key = os.getenv("RAZORPAY_KEY_ID", "")
    rzp_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    verified = False

    if rzp_key and rzp_secret and not body.razorpay_order_id.startswith("mock_"):
        try:
            import razorpay, hmac, hashlib
            msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}"
            sig = hmac.new(rzp_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
            verified = sig == body.razorpay_signature
        except Exception as e:
            logger.warning(f"Signature verification failed: {e}")
    else:
        verified = True   # mock/dev mode — always accept

    if not verified:
        raise HTTPException(400, "Payment verification failed.")

    # Upgrade user tier
    user.tier = SubscriptionTier(body.tier)
    db.commit()

    # Update billing record
    record = db.query(BillingRecord).filter(
        BillingRecord.razorpay_order_id == body.razorpay_order_id
    ).first()
    if record:
        record.razorpay_payment_id = body.razorpay_payment_id
        record.status = "paid"
        db.commit()

    token = create_access_token(user.id, user.email, user.tier.value)
    return {"success": True, "tier": user.tier.value, "token": token}


# ════════════════════════════════════════════════════════════════════════════════
# ENERGY DASHBOARD ROUTES (Pro+)
# ════════════════════════════════════════════════════════════════════════════════

class EnergyRequest(BaseModel):
    solar_irradiance:  float
    panel_area:        float
    efficiency:        float
    electricity_rate:  Optional[float] = 8.0
    energy_per_year:   Optional[float] = None


@app.post("/api/energy/dashboard", tags=["Energy"])
async def energy_dashboard(
    body: EnergyRequest,
    user: User = Depends(require_pro),
):
    """Full energy dashboard data — live curve + forecast + surplus + carbon + P2P + blockchain."""
    daily_kwh = body.solar_irradiance * body.panel_area * body.efficiency * 5.5
    annual_kwh = body.energy_per_year or (daily_kwh * 365)

    hourly      = ed.generate_24h_energy(body.solar_irradiance, body.panel_area, body.efficiency)
    forecast    = ed.predict_7day_energy(body.solar_irradiance, body.panel_area, body.efficiency)
    surplus     = ed.calculate_surplus(daily_kwh)
    carbon      = ed.calculate_carbon_savings(annual_kwh)
    p2p_market  = ed.generate_p2p_market(surplus["surplus_kwh"], body.electricity_rate)
    blockchain  = ed.generate_blockchain_ledger()

    return {
        "hourly_generation":  hourly,
        "weekly_forecast":    forecast,
        "surplus":            surplus,
        "carbon":             carbon,
        "p2p_market":         p2p_market,
        "blockchain_ledger":  blockchain,
        "daily_kwh":          round(daily_kwh, 2),
        "annual_kwh":         round(annual_kwh, 2),
    }


@app.post("/api/energy/carbon", tags=["Energy"])
async def carbon_endpoint(body: EnergyRequest, user: User = Depends(require_pro)):
    """Carbon savings endpoint."""
    annual_kwh = body.energy_per_year or (body.solar_irradiance * body.panel_area * body.efficiency * 5.5 * 365)
    return ed.calculate_carbon_savings(annual_kwh)


@app.post("/api/energy/p2p", tags=["Energy"])
async def p2p_endpoint(body: EnergyRequest, user: User = Depends(require_enterprise)):
    """P2P marketplace — Enterprise only."""
    daily_kwh = body.solar_irradiance * body.panel_area * body.efficiency * 5.5
    surplus   = ed.calculate_surplus(daily_kwh)
    return {
        "surplus":    surplus,
        "marketplace": ed.generate_p2p_market(surplus["surplus_kwh"], body.electricity_rate),
    }


@app.get("/api/energy/blockchain", tags=["Energy"])
async def blockchain_endpoint(user: User = Depends(require_enterprise)):
    """Blockchain ledger — Enterprise only."""
    return {"ledger": ed.generate_blockchain_ledger(10)}


# ════════════════════════════════════════════════════════════════════════════════
# HEATMAP — Micro-Grid Placement Analysis
# ════════════════════════════════════════════════════════════════════════════════

class HeatmapRequest(BaseModel):
    vertices: List[Tuple[float, float]]   # [[lat, lng], ...], min 3 points
    plant_size_kw:     float = 10.0
    solar_irradiance:  float = 5.5
    wind_speed:        float = 3.5
    temperature:       float = 25.0
    humidity:          float = 50.0
    cloud_cover_pct:   float = 30.0
    grid_distance_km:  Optional[float] = None
    available_area_m2: Optional[float] = None
    cell_metres:       int   = 100
    base_elevation:    float = 200.0   # reuse elevation from main analysis


@app.post("/api/heatmap", tags=["Analysis"])
@limiter.limit("10/minute")
async def heatmap_analysis(
    request: Request,
    body: HeatmapRequest,
    user: Optional[User] = Depends(get_current_user),
):
    """
    🌎 Micro-Grid Heatmap Analysis
    Divides the polygon into grid cells, scores each cell, identifies
    optimal placement sub-region, and returns grid-variance confidence calibration.
    """
    if len(body.vertices) < 3:
        raise HTTPException(400, "Polygon must have at least 3 vertices.")
    if body.cell_metres < 10 or body.cell_metres > 1000:
        raise HTTPException(400, "cell_metres must be 10–1000.")

    result = await compute_heatmap(
        vertices=body.vertices,
        plant_size_kw=body.plant_size_kw,
        solar_irradiance=body.solar_irradiance,
        wind_speed=body.wind_speed,
        temperature=body.temperature,
        humidity=body.humidity,
        cloud_cover_pct=body.cloud_cover_pct,
        grid_distance_km=body.grid_distance_km,
        available_area_m2=body.available_area_m2,
        cell_metres=body.cell_metres,
        base_elevation=body.base_elevation,
    )
    logger.info(f"[Heatmap] {result['cell_count']} cells, mean={result['score_mean']}, "
                f"conf_calibrated={result['confidence_calibrated']}%")
    return result


# ════════════════════════════════════════════════════════════════════════════════
# SEASONAL — Monthly Irradiance Time-Series
# ════════════════════════════════════════════════════════════════════════════════

@app.get("/api/seasonal", tags=["Analysis"])
async def seasonal_analysis(
    lat: float,
    lng: float,
    plant_size_kw: float = 10.0,
    user: Optional[User] = Depends(get_current_user),
):
    """
    📅 Seasonal Time-Series Simulation
    Fetches NASA POWER 12-month climatology for the location, computes
    monthly generation estimates and seasonal stability index.
    """
    seasonal = await fetch_monthly_irradiance(lat, lng)
    # Scale generation by actual plant size
    seasonal["monthly_gen_kwh"] = [
        round(v * plant_size_kw, 1)
        for v in seasonal["monthly_gen_kwh_per_kw"]
    ]
    seasonal["annual_total_kwh"] = round(seasonal["annual_kwh_per_kw"] * plant_size_kw, 0)
    seasonal["plant_size_kw"]    = plant_size_kw
    return seasonal


# ════════════════════════════════════════════════════════════════════════════════
# TARIFF SENSITIVITY
# ════════════════════════════════════════════════════════════════════════════════

class TariffSensRequest(BaseModel):
    lat:              float
    lng:              float
    plant_size_kw:    float  = 10.0
    solar_irradiance: float  = 5.5
    installation_cost: float = 500000.0

@app.post("/api/roi/sensitivity", tags=["Analysis"])
async def tariff_sensitivity(
    body: TariffSensRequest,
    user: Optional[User] = Depends(get_current_user),
):
    """
    📉 Tariff Sensitivity Analysis
    Returns ROI metrics at ₹4/6/8/10/12/15 per kWh for sensitivity chart.
    """
    table = calculate_tariff_sensitivity(
        solar_irradiance=body.solar_irradiance,
        plant_size_kw=body.plant_size_kw,
        installation_cost=body.installation_cost,
    )
    return {"sensitivity": table, "plant_size_kw": body.plant_size_kw}


# ════════════════════════════════════════════════════════════════════════════════
# NATIONWIDE INDIA HEATMAP
# ════════════════════════════════════════════════════════════════════════════════

@app.get("/api/heatmap/nationwide", tags=["Analysis"])
async def nationwide_heatmap(
    plant_size_kw: float = 10.0,
    user: Optional[User] = Depends(get_current_user),
):
    """
    🏭🗳️ Nationwide India Solar Heatmap
    Pre-computed 0.75°-resolution grid across all of India (~1300 cells).
    Uses estimated climate data — no external API calls — cached after first run.
    Returns cells with scores, top regions, and optimal national location.
    """
    result = await compute_nationwide_heatmap(plant_size_kw=plant_size_kw)
    return result
