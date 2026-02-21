# HelioScope AI — Complete Project Documentation

**Version:** 2.0 (Production)  
**Date:** February 2026  
**Authors:** HelioScope AI Team  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Scoring Algorithm (v3)](#3-scoring-algorithm-v3)
4. [Data Pipeline](#4-data-pipeline)
5. [Backend Services](#5-backend-services)
6. [Frontend Components](#6-frontend-components)
7. [Database Schema](#7-database-schema)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Billing System](#9-billing-system)
10. [API Reference](#10-api-reference)
11. [Deployment Guide](#11-deployment-guide)
12. [Configuration Reference](#12-configuration-reference)
13. [Testing](#13-testing)

---

## 1. Project Overview

### 1.1 What is HelioScope AI?

HelioScope AI is a production-grade **renewable energy placement intelligence platform** that uses satellite data, advanced multi-factor algorithms, and AI to help users identify optimal solar installation sites. It performs real-time analysis of any geographic location and returns:

- **Placement score** (0–100) with letter grade and confidence percentage
- **Suitability classification** (Excellent / Good / Moderate / Poor / Unsuitable)
- **Constraint detection** (terrain slope, solar insufficiency, grid distance)
- **ROI and financial projections** (payback period, lifetime savings, PM Surya Ghar subsidy)
- **AI-generated site report** (Google Gemini 2.0 Flash)

### 1.2 Core Philosophy

> "Don't just tell users where solar panels can go — tell them exactly how viable it is, why, and what it's worth."

### 1.3 Target Users

| User Type | Use Case |
|-----------|----------|
| Homeowners | Rooftop solar feasibility for houses / apartments |
| Solar developers | Site scouting, portfolio analysis |
| Government / NGOs | Rural electrification planning |
| Investors | Solar farm due diligence |
| Researchers | Regional solar irradiance analysis |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
User Browser
     │
     ▼
React Frontend (Vite + Leaflet.js)
     │  REST/JSON
     ▼
FastAPI Backend (Python 3.12)
     │
     ├── NASA POWER API  (solar irradiance — 365-day avg)
     ├── Open-Meteo API  (wind + temp + humidity + cloud cover)
     ├── Elevation API   (Google / Open-Elevation — 5-point stencil)
     ├── Gemini AI       (site report generation)
     └── PostgreSQL DB   (user data + analysis history)
```

### 2.2 Request Flow

```
Step 1: User selects location on map (lat/lng)
Step 2: User configures plant size (10/20/30/50kW), panel type, rate
Step 3: Frontend sends POST /api/analyze
Step 4: Backend concurrently fetches:
          • NASA POWER → solar irradiance (12-month avg)
          • Open-Meteo → wind, temp, humidity, cloud cover (7-day avg)
          • Elevation API → elevation + slope (5-point stencil)
Step 5: 8-factor scoring engine calculates placement score + confidence
Step 6: ROI engine computes financials (capacity-first: kW × irradiance × 365 × 0.80)
Step 7: Gemini 2.0 Flash generates AI site report
Step 8: Analysis saved to PostgreSQL (feeds adaptive EMA calibrator)
Step 9: Full response returned to React frontend
Step 10: Dashboard auto-expands to 90% width, results displayed
```

### 2.3 Technology Stack

**Backend:**
- Python 3.12, FastAPI 0.115, Uvicorn
- SQLAlchemy 2.0 + PostgreSQL 16
- JWT (HS256) authentication, bcrypt password hashing
- SlowAPI rate limiting (20/min on analyze endpoint)
- httpx (async HTTP client for external APIs)

**Frontend:**
- React 19, Vite 7
- Leaflet.js + react-leaflet (satellite/dark map tiles)
- Recharts (energy dashboard charts)
- Nominatim API (geocoding search bar)
- Vanilla CSS (dark glassmorphism design system)

**Infrastructure (optional):**
- Docker + docker-compose
- Kubernetes (k8s YAML manifests included)
- Nginx (frontend serving + reverse proxy)

---

## 3. Scoring Algorithm (v3)

### 3.1 Overview

The scoring engine uses a **hybrid Gaussian-sigmoid normalization** model with **adaptive regional calibration**. It is the core intelligence of HelioScope AI.

```
Final Score = clamp(Weighted_Sum × 105, 0, 100) + EMA_Calibration_Adjustment
```

### 3.2 Factor Set

| # | Factor | Weight | Method | Optimal Range | Physical Justification |
|---|--------|--------|--------|---------------|------------------------|
| 1 | Solar Irradiance | 30% | Gaussian | 5.5 kWh/m²/d | Primary energy driver |
| 2 | Temperature | 10% | Gaussian | 22°C | Panel STC efficiency |
| 3 | Elevation | 10% | Gaussian | 600m | Atmospheric clarity, drainage |
| 4 | Wind Speed | 8% | Gaussian | 3.5 m/s | Convective panel cooling |
| 5 | Cloud Cover | 10% | Sigmoid (inverted) | 0–30% | Direct irradiance reduction |
| 6 | Terrain Slope | 10% | Step function | <5° | Structural feasibility |
| 7 | Grid Proximity | 12% | Sigmoid | <10 km | Connection cost / ROI |
| 8 | Plant Feasibility | 10% | Sigmoid | area ≥ kW×8 | Land/capacity viability |

**Total: 100%**

### 3.3 Normalization Functions

**Gaussian (bell-curve)** — for factors with an optimal range:
```python
def gaussian(x, optimal, spread):
    return exp(-0.5 * ((x - optimal) / spread) ** 2)
```

**Sigmoid (monotonic)** — for factors where higher/lower is always better:
```python
def sigmoid(x, midpoint, steepness=1.0):
    return 1 / (1 + exp(-steepness * (x - midpoint)))
```

**Step function** — for discrete terrain slope classification (industry standard, IEC/NREL):
```
<5°    → 1.00  (flat, ideal for any installation)
5–15°  → 0.65  (acceptable with angled mounting)
15–25° → 0.30  (marginal, high mounting cost)
>25°   → 0.05  (unsuitable)
```

### 3.4 Confidence Score

```python
confidence = 0.50 × factor_agreement + 0.30 × source_quality + 0.20 × plausibility
```

- **Factor agreement**: 1 − variance of sub-scores / max_variance
- **Source quality**: live API responses / 4 (4 = all APIs responded)
- **Plausibility**: penalty for physically impossible inputs

### 3.5 Constraint Filtering

Hard constraints that trigger **early rejection** before scoring:

| Constraint | Threshold | Violation Message |
|-----------|-----------|-------------------|
| Minimum solar | < 2.0 kWh/m²/d | "Solar irradiance insufficient" |
| Maximum slope | > 25° | "Terrain unsuitable" |
| Maximum cloud | > 90% | "Permanent overcast" |
| Maximum grid distance | > 100 km | "Grid connection unviable" |
| Minimum area | < 40% of required | "Insufficient land area" |

### 3.6 Adaptive EMA Calibrator

Learns regional biases from historical analysis data:

```python
# On startup: load last 180 days of analyses from DB
calibrator.load_from_db(db_session)

# Each analysis: record observation
calibrator.record(lat, lng, score)

# Regional adjustment applied to each new score:
adjustment = EMA(actual - predicted) × 0.60 + regional_delta × 0.40
final_score = raw_score + clamp(adjustment, -10, +10)
```

**EMA alpha = 0.12** (slow learning for stable regional signals)  
**Minimum 5 samples** before calibration activates per region.  
**5° × 5° grid cells** for regional grouping.

### 3.7 Grade Scale

| Score | Grade | Suitability | Recommendation |
|-------|-------|-------------|----------------|
| 88–100 | A+ | Excellent | Exceptional — Top-tier solar site |
| 78–87 | A | Excellent | Highly recommended |
| 68–77 | B+ | Good | Recommended |
| 58–67 | B | Good | Promising |
| 47–57 | C | Moderate | Moderate |
| 35–46 | D | Poor | Marginal |
| 0–34 | F | Unsuitable | Not Recommended |

---

## 4. Data Pipeline

### 4.1 Solar Irradiance — NASA POWER API

**Endpoint:** `https://power.larc.nasa.gov/api/temporal/daily/point`  
**Parameter:** `ALLSKY_SFC_SW_DWN` (all-sky surface shortwave downward irradiance)  
**Period:** Last 365 days (excludes fill values: −999)  
**Fallback:** `temporal/climatology/point` (long-term annual average)  
**Final fallback:** Latitude-based estimate table

```python
# India subtropical (lat 20–30°) → ~5.5 kWh/m²/d estimate
# India tropical   (lat 8–20°)   → ~6.0 kWh/m²/d estimate
```

### 4.2 Weather Data — Open-Meteo API

**Single call** returns all 4 weather factors:
```
wind_speed_10m | temperature_2m | relative_humidity_2m | cloudcover
```
**Period:** 7-day forecast hourly average  
**Fallback:** Latitude-based climatological estimates

### 4.3 Elevation & Slope — Batch Elevation API

5-point stencil approach:
```
Fetch: [centre, N+200m, S+200m, E+200m, W+200m]
Gradient: dz/dx = |E−W| / (2 × 200m)
          dz/dy = |N−S| / (2 × 200m)
Slope: degrees(atan(sqrt(dz/dx² + dz/dy²)))
```

**Priority:**
1. Google Maps Elevation API (batch, requires `GOOGLE_ELEVATION_API_KEY`)
2. Open-Elevation (free, no key, single POST)
3. Region-based estimate table

### 4.4 Grid Distance Estimation

Heuristic when user does not provide `grid_distance_km`:
```
India Indo-Gangetic Plain (lat 20–30°, lng 68–97°) → 8 km
India South (lat <20°)                             → 10 km
India Himalayan (lat >30°)                         → 20 km
Europe                                             → 5 km
North America                                      → 12 km
Africa                                             → 25 km
Global default                                     → 15 km
```

---

## 5. Backend Services

### 5.1 `scoring.py` — Placement Scoring Engine

```
calculate_score(solar, wind, elevation, temperature, humidity, lat,
                cloud_cover_pct, slope_degrees, grid_distance_km,
                plant_size_kw, available_area_m2, data_sources)
→ dict: score, grade, confidence, suitability_class, constraint_violations,
        8 sub-scores, calibration_adjustment, algorithm_version
```

### 5.2 `roi.py` — ROI Engine

**Capacity-first mode** (plant_size_kw provided):
```
land_area_m2         = plant_size_kw × 8.0  (industry: 8 m²/kW for crystalline Si)
annual_energy_kwh    = plant_size_kw × solar_irradiance × 365 × 0.80
installation_cost_₹  = plant_size_kw × 50,000  (MNRE 2026 benchmark: ₹50k/kW)
annual_savings_₹     = annual_energy_kwh × electricity_rate
payback_years        = installation_cost / annual_savings
```

**Degradation-aware lifetime model:**
```
lifetime_yield = Σ(annual_kwh × (1 − 0.005)^year, year=0..24)
```

**PM Surya Ghar CFA Subsidy (MNRE 2026):**
| System Size | Subsidy |
|------------|---------|
| ≤ 1 kWp | ₹30,000 |
| ≤ 2 kWp | ₹60,000 |
| ≤ 3 kWp | ₹78,000 |
| > 3 kWp | ₹78,000 (capped) |

### 5.3 `solar_service.py` — NASA POWER Client

- Async HTTP (httpx)
- 365-day daily average → climatology → latitude estimate (3 fallbacks)
- Filters NASA fill values (−999)

### 5.4 `wind_service.py` — Open-Meteo Client

- Single async call returns: wind, temperature, humidity, cloud cover
- `data_sources` counter (4 = all live, 1 = all estimated)

### 5.5 `elevation_service.py` — Elevation + Slope

- Batch 5-point stencil
- Google Maps → Open-Elevation → region estimate

### 5.6 `llm_service.py` — Gemini AI

- Model: `gemini-2.0-flash`
- Generates structured site assessment in ~2 seconds
- Fallback: rule-based template summary

### 5.7 `auth.py` — JWT Authentication

- JWT HS256, 30-day expiry
- bcrypt password hashing (12 rounds)
- Free tier: 3 analyses/month
- Quota enforcement on `/api/analyze`

---

## 6. Frontend Components

| Component | Purpose |
|-----------|---------|
| `App.jsx` | Root state management, layout, dashboard expand/collapse |
| `MapComponent.jsx` | Leaflet map, satellite tiles, polygon area drawing, geocoding search, pin markers |
| `AnalysisPanel.jsx` | Plant-size selector (10/20/30/50kW), panel type, electricity rate, analyze button |
| `ResultsPanel.jsx` | Score gauge, 8-factor bar chart, confidence badge, suitability class, constraint violations |
| `ROIComponent.jsx` | Financial summary, payback period, PM Surya Ghar subsidy breakdown |
| `SummaryComponent.jsx` | AI-generated site report display |
| `EnergyDashboard.jsx` | 7-tab Smart Energy Dashboard (Pro+ gated) with Recharts |
| `AuthModal.jsx` | Register/login modal with JWT |
| `BillingModal.jsx` | Subscription tier selection |
| `ProGate.jsx` | HOC that wraps Pro-only features |

### 6.1 Layout System

```
main-content (CSS Grid)
├── Map Column (10% when expanded, rest otherwise)
│   └── MapComponent
└── Sidebar Column (90% when expanded, 520px otherwise)
    ├── Close Bar (sticky, non-scrolling)
    └── Scrollable Content
        ├── AnalysisPanel
        ├── ResultsPanel
        ├── ROIComponent
        ├── SummaryComponent
        └── EnergyDashboard
```

**Dashboard expand trigger:** Auto-expands to 90% width when analysis completes.

### 6.2 Map Features

- **Tile layers:** Dark (CartoDB), Satellite (ESRI World Imagery), OpenStreetMap
- **Area drawing:** Click to place vertices, double-click to close polygon. Geodesic area calculated via spherical excess formula.
- **GPS auto-center:** Silently centres map on user location on startup
- **Geocoding search:** Nominatim API with 350ms debounce, `flyTo` animation

---

## 7. Database Schema

### `analysis_results` table

```sql
CREATE TABLE analysis_results (
    id                      SERIAL PRIMARY KEY,
    lat                     FLOAT NOT NULL,
    lng                     FLOAT NOT NULL,
    panel_area              FLOAT,
    efficiency              FLOAT,
    solar_irradiance        FLOAT,
    wind_speed              FLOAT,
    elevation               FLOAT,
    score                   INTEGER,
    grade                   VARCHAR(4),
    solar_score             FLOAT,
    wind_score              FLOAT,
    elevation_score         FLOAT,
    recommendation          TEXT,
    energy_output_kwh_per_year FLOAT,
    annual_savings_inr      FLOAT,
    payback_years           FLOAT,
    lifetime_profit_inr     FLOAT,
    ai_summary              TEXT,
    ai_provider             VARCHAR(50),
    created_at              TIMESTAMP DEFAULT NOW()
);
```

### `users` table

```sql
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    tier          VARCHAR(20) DEFAULT 'free',  -- free | pro | enterprise
    analyses_used INTEGER DEFAULT 0,
    created_at    TIMESTAMP DEFAULT NOW()
);
```

---

## 8. Authentication & Authorization

### 8.1 Flow

```
POST /api/auth/register  →  Create user, return JWT
POST /api/auth/login     →  Verify password, return JWT
GET  /api/auth/me        →  Return current user from JWT

All protected endpoints:
  Authorization: Bearer <JWT>
```

### 8.2 Tier Permissions

```python
require_auth       # must be logged in
require_pro        # tier in ['pro', 'enterprise']
require_enterprise # tier == 'enterprise'
check_free_quota   # free users: max 3 analyses/month
```

---

## 9. Billing System

### 9.1 Subscription Tiers

| Tier | Price | Analyses/month | Features |
|------|-------|---------------|---------|
| Free | ₹0 | 3 | Basic placement score |
| Pro | ₹499/mo | 50 | + Energy Dashboard, AI Reports |
| Enterprise | ₹1,999/mo | Unlimited | + Export, priority support |

### 9.2 Integration

Billing UI implemented via `BillingModal.jsx`. Production integration with Razorpay ready in billing service (key config in `.env`).

---

## 10. API Reference

### Base URL
`http://localhost:8001` (development)

### Endpoints

#### `POST /api/analyze` — Main Pipeline
```json
Request:
{
  "lat": 26.92,
  "lng": 70.90,
  "plant_size_kw": 20,
  "panel_area": 100,
  "efficiency": 0.20,
  "electricity_rate": 8.0,
  "installation_cost": 0,
  "grid_distance_km": null,
  "available_area_m2": null
}

Response:
{
  "score": 90,
  "grade": "A+",
  "confidence": 96.0,
  "suitability_class": "Excellent",
  "recommendation": "Exceptional...",
  "constraint_violations": [],
  "is_suitable": true,
  "solar_irradiance": 6.5,
  "wind_speed": 3.2,
  "elevation": 255.0,
  "temperature_c": 24.8,
  "humidity_pct": 35.4,
  "cloud_cover_pct": 18.0,
  "slope_degrees": 1.2,
  "solar_score": 92.1,
  "wind_score": 97.0,
  "elevation_score": 88.2,
  "temperature_score": 84.0,
  "cloud_score": 88.5,
  "slope_score": 100.0,
  "grid_score": 84.0,
  "plant_size_score": 95.0,
  "calibration_adjustment": 2.5,
  "plant_size_kw": 20.0,
  "required_land_area_m2": 160.0,
  "system_size_kwp": 20.0,
  "installation_cost_inr": 1000000,
  "energy_output_kwh_per_year": 38000,
  "annual_savings_inr": 304000,
  "payback_years": 3.3,
  "subsidy_amount_inr": 78000,
  "net_cost_after_subsidy_inr": 922000,
  "payback_years_after_subsidy": 3.0,
  "lifetime_profit_inr": 6620000,
  "ai_summary": "This location in Rajasthan...",
  "algorithm_version": "v3-production"
}
```

#### `GET /api/health`
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "services": {
    "scoring_engine": "v3-production",
    "roi_engine": "v2-plant-size",
    "gemini": "configured",
    "database": "connected"
  }
}
```

#### `POST /api/auth/register`
```json
Request: { "email": "user@example.com", "password": "..." }
Response: { "access_token": "...", "token_type": "bearer", "user": {...} }
```

#### `POST /api/auth/login`
Same as register response format.

---

## 11. Deployment Guide

### 11.1 Docker Compose (Recommended)
```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f backend

# Stop
docker-compose down
```

### 11.2 Kubernetes
```bash
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
```

### 11.3 Manual Production Deployment

**Backend:**
```bash
pip install -r requirements.txt
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001
```

**Frontend:**
```bash
npm run build
# Serve dist/ with nginx
```

---

## 12. Configuration Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | JWT signing secret (min 32 chars) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `GOOGLE_ELEVATION_API_KEY` | ⬜ | Google Maps Elevation API (optional, falls back to Open-Elevation) |
| `ALLOWED_ORIGINS` | ⬜ | CORS allowed origins (comma-separated) |
| `VITE_API_URL` | ✅ | Frontend API base URL |

---

## 13. Testing

### 13.1 Backend Unit Tests

```bash
cd backend && python3 -c "
from scoring import calculate_score

# Rajasthan — should score 88+
r = calculate_score(6.5, 3.5, 250, 34, 35, 26,
                    cloud_cover_pct=20, slope_degrees=2,
                    grid_distance_km=8, plant_size_kw=20,
                    available_area_m2=200, data_sources=4)
assert r['score'] >= 85, f'Expected 85+, got {r[\"score\"]}'
assert r['suitability_class'] == 'Excellent'
print('✅ Scoring engine tests passed')
"
```

### 13.2 API Integration Test

```bash
# Health check
curl http://localhost:8001/api/health

# Full analysis (Rajasthan)
curl -X POST http://localhost:8001/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"lat":26.92,"lng":70.90,"plant_size_kw":20,"electricity_rate":8.0}'
```

### 13.3 Known Score Benchmarks

| Location | Expected Score | Grade |
|----------|---------------|-------|
| Rajasthan (Jodhpur) | 88–92 | A+ |
| Bengaluru | 88–96 | A+ |
| Gujarat Solar Park | 90–95 | A+ |
| Mumbai Coastal | 80–90 | A |
| Shimla | 65–75 | B+/B |
| London UK | 55–65 | B/C |
| Norway (Arctic) | 25–35 | F |

---

*© 2026 HelioScope AI — All rights reserved*
