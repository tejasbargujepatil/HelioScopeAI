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

    # Net metering (v3)
    daily_generation_kwh: float = 0.0
    daily_consumption_kwh: float = 10.0
    daily_excess_kwh: float = 0.0
    annual_export_kwh: float = 0.0
    net_metering_credit_inr: float = 0.0
    effective_annual_savings_inr: float = 0.0
    payback_years_with_net_metering: float = 99.0

    # ── AI Summary ────────────────────────────────────────────────────────
    ai_summary: str
    ai_generated_by: str


# ────────────────────────────────────────────────────────────────────
# Heatmap models
# ────────────────────────────────────────────────────────────────────
class HeatmapRequest(BaseModel):
    vertices: List[List[float]]   # [[lat, lng], ...]
    plant_size_kw: float = Field(default=10.0, gt=0)
    resolution_m: float = Field(default=100.0, ge=10, le=1000)

class HeatmapCell(BaseModel):
    lat: float
    lng: float
    score: int
    suitability: str
    solar_irradiance: float
    slope_degrees: float

class OptimalCell(BaseModel):
    lat: float
    lng: float
    score: int
    suitability: str
    reason: str

class HeatmapResponse(BaseModel):
    cells: List[HeatmapCell]
    optimal_cell: Optional[OptimalCell]
    spatial_confidence: float
    score_variance: float
    avg_cell_score: float
    total_cells: int
    resolution_m: float
    polygon_area_m2: float
    base_solar_irradiance: float


# ────────────────────────────────────────────────────────────────────
# Seasonal models
# ────────────────────────────────────────────────────────────────────
class MonthSummary(BaseModel):
    month: str
    month_idx: int
    irradiance_kwh_m2_day: float
    generation_kwh: float
    days: int

class SeasonalResponse(BaseModel):
    monthly_irradiance: List[float]
    monthly_generation_kwh: List[float]
    annual_total_kwh: float
    avg_irradiance: float
    stability_index: float
    cov_pct: float
    peak_month: str
    peak_irradiance: float
    low_month: str
    low_irradiance: float
    monthly_summary: List[MonthSummary]


# ────────────────────────────────────────────────────────────────────
# Tariff sensitivity models
# ────────────────────────────────────────────────────────────────────
class TariffSensitivityRequest(BaseModel):
    lat: float
    lng: float
    plant_size_kw: float = Field(default=10.0, gt=0)
    tariff_min: float    = Field(default=4.0, ge=1)
    tariff_max: float    = Field(default=20.0, le=50)
    tariff_step: float   = Field(default=2.0, ge=0.5)
    daily_consumption_kwh: float = Field(default=10.0, ge=0)

class TariffPoint(BaseModel):
    tariff_inr_per_kwh: float
    annual_savings_inr: float
    payback_years: float
    payback_after_subsidy: float
    net_metering_credit: float
    effective_savings: float

class TariffSensitivityResponse(BaseModel):
    plant_size_kw: float
    solar_irradiance: float
    data_points: List[TariffPoint]
    optimal_tariff: float
    break_even_tariff: float
