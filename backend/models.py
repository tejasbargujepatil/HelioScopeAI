"""
HelioScope AI — Pydantic Data Models v3
Supports 8-factor scoring engine, plant-size capacity planning, confidence score.
"""
from pydantic import BaseModel, Field
from typing import Optional, List


# ── Location / Climate ─────────────────────────────────────────────────────────

class LocationRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    panel_area: float = Field(default=100.0, gt=0)
    efficiency: float = Field(default=0.20, gt=0, le=1)


class ClimateData(BaseModel):
    solar_irradiance: float
    wind_speed: float
    elevation: float


class PlacementScoreResponse(BaseModel):
    score: int
    grade: str
    solar_irradiance: float
    wind_speed: float
    elevation: float
    solar_score: float
    wind_score: float
    elevation_score: float
    lat: float
    lng: float
    recommendation: str


# ── ROI ───────────────────────────────────────────────────────────────────────

class ROIRequest(BaseModel):
    solar_irradiance: float
    panel_area: float = Field(default=100.0, gt=0)
    efficiency: float = Field(default=0.20, gt=0, le=1)
    electricity_rate: float = Field(default=8.0)
    installation_cost: float = Field(default=0.0)
    plant_size_kw: Optional[float] = Field(default=None, gt=0)


class ROIResponse(BaseModel):
    energy_output_kwh_per_year: float
    annual_savings_inr: float
    payback_years: float
    lifetime_profit_inr: float
    monthly_savings_inr: float
    system_lifetime_years: int


class SummaryRequest(BaseModel):
    score: int
    roi_years: float
    lat: float
    lng: float
    solar_irradiance: Optional[float] = None
    wind_speed: Optional[float] = None
    elevation: Optional[float] = None
    annual_savings: Optional[float] = None


class SummaryResponse(BaseModel):
    summary: str
    generated_by: str


class HealthResponse(BaseModel):
    status: str
    version: str
    services: dict


# ── Unified Pipeline v3 ────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    """
    Full pipeline request — capacity-first planning supported via plant_size_kw.
    """
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)

    # Capacity-first (preferred)
    plant_size_kw: Optional[float] = Field(
        default=10.0, gt=0,
        description="Desired plant capacity in kW (10/20/30/50 or custom)"
    )

    # Legacy area-first (still supported)
    panel_area: float = Field(default=80.0, ge=0, description="Panel area m² (0 = use plant_size_kw only)")
    efficiency: float = Field(default=0.20, gt=0, le=1)

    electricity_rate: float  = Field(default=8.0,  description="₹/kWh")
    installation_cost: float = Field(default=0.0,  description="₹ (0 = auto from plant_size)")

    # Optional user hints for scoring
    grid_distance_km: Optional[float] = Field(default=None, ge=0, description="km to nearest grid")
    available_area_m2: Optional[float] = Field(default=None, ge=0)


class AnalyzeResponse(BaseModel):
    """
    Full pipeline response — placement score + ROI + confidence + AI summary.
    """
    # ── Location ─────────────────────────────────────────────────────────
    lat: float
    lng: float

    # ── Measured climate data ─────────────────────────────────────────────
    solar_irradiance: float
    wind_speed: float
    elevation: float
    temperature_c: float
    humidity_pct: float
    cloud_cover_pct: float
    slope_degrees: float

    # ── Placement score ───────────────────────────────────────────────────
    score: int
    grade: str
    confidence: float                       # 0-100 %
    suitability_class: str                  # Excellent / Good / Moderate / Poor / Unsuitable
    recommendation: str
    constraint_violations: List[str]
    is_suitable: bool

    # Per-factor sub-scores (0-100)
    solar_score: float
    wind_score: float
    elevation_score: float
    temperature_score: float
    cloud_score: float
    slope_score: float
    grid_score: float
    plant_size_score: float

    calibration_adjustment: float
    algorithm_version: str

    # ── Plant sizing ──────────────────────────────────────────────────────
    plant_size_kw: float
    required_land_area_m2: float
    system_size_kwp: float
    installation_cost_inr: float

    # ── ROI ───────────────────────────────────────────────────────────────
    energy_output_kwh_per_year: float
    annual_savings_inr: float
    monthly_savings_inr: float
    daily_savings_inr: float
    payback_years: float
    lifetime_profit_inr: float
    system_lifetime_years: int

    # PM Surya Ghar subsidy
    subsidy_amount_inr: float
    net_cost_after_subsidy_inr: float
    payback_years_after_subsidy: float
    lifetime_profit_after_subsidy_inr: float

    # ── AI Summary ────────────────────────────────────────────────────────
    ai_summary: str
    ai_generated_by: str
