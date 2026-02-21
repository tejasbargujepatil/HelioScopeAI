"""
HelioScope AI — Production-Grade Placement Scoring Engine v3
=============================================================
Hybrid multi-factor renewable energy placement optimization engine using
Gaussian-sigmoid scoring, economic feasibility modeling, plant capacity
planning, and adaptive regional calibration.

Factor set (8 factors, weights sum to 1.0):
  1. Solar irradiance      — Gaussian, 30%  (primary energy driver)
  2. Temperature           — Gaussian, 10%  (panel efficiency factor)
  3. Elevation             — Gaussian, 10%  (atmospheric clarity)
  4. Wind speed            — Gaussian,  8%  (panel cooling)
  5. Cloud cover           — Sigmoid,  10%  (yield reduction)
  6. Terrain slope         — Step,     10%  (structural feasibility)
  7. Grid proximity        — Sigmoid,  12%  (economic feasibility)
  8. Plant-size feasibility— Sigmoid,  10%  (capacity/land viability)

Constraint filtering rejects clearly unsuitable sites before scoring.
Confidence score models data variance + factor agreement.
Adaptive EMA calibrator adjusts scores using regional historical data.
"""

import math
import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# ── Weight table ──────────────────────────────────────────────────────────────
WEIGHTS = {
    "solar":       0.30,
    "temperature": 0.10,
    "elevation":   0.10,
    "wind":        0.08,
    "cloud":       0.10,
    "slope":       0.10,
    "grid":        0.12,
    "plant_size":  0.10,
}
assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9, "Weights must sum to 1.0"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — Primitive normalisation functions
# ═══════════════════════════════════════════════════════════════════════════════

def gaussian(x: float, optimal: float, spread: float) -> float:
    """
    Gaussian bell-curve: peaks at 1.0 when x == optimal, falls off symmetrically.
    φ(x) = exp(-½·((x − optimal) / spread)²)
    Used for factors with a clear optimum range.
    """
    try:
        return math.exp(-0.5 * ((x - optimal) / spread) ** 2)
    except (ZeroDivisionError, OverflowError):
        return 0.0


def sigmoid(x: float, midpoint: float, steepness: float = 1.0) -> float:
    """
    Logistic sigmoid: monotonically increases, never decreases.
    σ(x) = 1 / (1 + e^(−k·(x − midpoint)))
    Used for monotonic factors (higher is always better / worse).
    """
    try:
        return 1.0 / (1.0 + math.exp(-steepness * (x - midpoint)))
    except OverflowError:
        return 0.0 if x < midpoint else 1.0


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — Individual factor scoring functions
# ═══════════════════════════════════════════════════════════════════════════════

def score_solar(irradiance: float) -> float:
    """
    Gaussian: optimal 5.5 kWh/m²/d (India top-tier sites), spread 1.8.
    • > 6.0 → ~0.92   World-class (Rajasthan, Thar)
    • 4.5–6.0 → 0.70–0.92  India excellent
    • 3.5–4.5 → 0.45–0.70  India moderate / temperate Europe
    • < 3.0 → < 0.35  Poor (temperate / overcast)
    """
    return gaussian(irradiance, optimal=5.5, spread=1.8)


def score_temperature(temp_c: float) -> float:
    """
    Gaussian: optimal 22°C, spread 12.
    Panel STC rating is at 25°C. Above ~40°C: heavy efficiency loss (~0.4%/°C).
    Below 0°C is also suboptimal for inverter / system efficiency.
    """
    return gaussian(temp_c, optimal=22.0, spread=12.0)


def score_elevation(elevation: float) -> float:
    """
    Gaussian: optimal 600m, spread 700m.
    Higher elevation → thinner atmosphere → more irradiance, less dust.
    Very high (>3000m) → remote, cold, structural challenges.
    Very low (<50m coastal) → haze, humidity, salt corrosion.
    """
    raw = gaussian(elevation, optimal=600.0, spread=700.0)
    # Ensure flat coastal plain (e.g. 10m) still gets a reasonable floor score
    floor = clamp(sigmoid(elevation, midpoint=50.0, steepness=0.008), 0, 0.55)
    return clamp(0.65 * raw + 0.35 * floor)


def score_wind(wind_speed: float) -> float:
    """
    Gaussian: optimal 3.5 m/s, spread 3.0.
    Gentle breeze cools panels, improving efficiency by ~1-2%.
    High wind (>10 m/s) risks structural damage.
    Calm (<1 m/s) means no convective cooling.
    """
    return gaussian(wind_speed, optimal=3.5, spread=3.0)


def score_cloud(cloud_cover_pct: float) -> float:
    """
    Sigmoid (inverted): low cloud → high score. Monotonic — less cloud always better.
    σ applied to (100 − cloud_pct):
    • 0-15% cloud → 0.85–0.95   Desert / arid (excellent)
    • 30-50% → 0.55–0.70        Typical India
    • 70-100% → 0.20–0.40       Monsoon / Nordic
    """
    return sigmoid(100.0 - cloud_cover_pct, midpoint=50.0, steepness=0.06)


def score_slope(slope_degrees: float) -> float:
    """
    Step function (industry standard, IEC/NREL guidelines):
    < 5°  → 1.00  Flat / ideal
    5–15° → 0.65  Acceptable with mounting adjustments
    15–25°→ 0.30  Marginal — significant mounting cost
    > 25° → 0.05  Unsuitable — prohibitive terrain
    """
    if slope_degrees < 5.0:    return 1.00
    elif slope_degrees < 15.0: return 0.65
    elif slope_degrees < 25.0: return 0.30
    else:                       return 0.05


def score_grid(distance_km: float) -> float:
    """
    Sigmoid (decreasing): closer to grid → lower connection cost → better.
    grid_score = 1 − (distance_km / 50)   [industry rule of thumb]
    Capped: > 50km → near-zero viability for small plants.
    """
    return clamp(1.0 - distance_km / 50.0)


def score_plant_size(
    plant_size_kw: float,
    available_area_m2: float,
    irradiance: float,
) -> float:
    """
    Feasibility of the requested plant size given location area and irradiance.
    Required land: ~8 m² per kW (industry standard for crystalline silicon).
    Also checks if irradiance is sufficient for the plant to be economically viable.
    """
    required_m2 = plant_size_kw * 8.0
    if available_area_m2 <= 0:
        available_area_m2 = required_m2  # no area constraint given → assume feasible

    area_ratio = clamp(available_area_m2 / required_m2)  # 1.0 = perfect fit

    # Irradiance feasibility: minimum 3.0 kWh/m²/d for viability
    irr_sigmoid = sigmoid(irradiance, midpoint=3.5, steepness=1.2)

    return clamp(0.6 * area_ratio + 0.4 * irr_sigmoid)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — Confidence score
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_confidence(
    solar: float,
    wind: float,
    temp: float,
    humidity: float,
    cloud: float,
    slope: float,
    grid_km: float,
    data_sources: int = 3,  # number of live API sources that responded
) -> float:
    """
    Confidence score (0-100%) based on:
    1. Factor agreement — do all factors point in the same direction?
    2. Data source quality — how many live APIs responded vs fallback estimates?
    3. Input plausibility — are values within realistic physical ranges?

    Returns a float 0-100.
    """
    scores_01 = [
        score_solar(solar),
        score_temperature(temp),
        score_wind(wind),
        score_cloud(cloud),
    ]

    # Factor agreement: low variance in sub-scores → higher confidence
    mean_s = sum(scores_01) / len(scores_01)
    variance = sum((s - mean_s)**2 for s in scores_01) / len(scores_01)
    agreement = clamp(1.0 - variance / 0.25)   # 0.25 = max expected variance

    # Data source bonus
    source_quality = clamp(data_sources / 4.0)  # 4 live sources = perfect

    # Plausibility checks
    plausibility_penalties = 0.0
    if not (0.0 <= solar <= 12.0):  plausibility_penalties += 0.15
    if not (-60 <= temp <= 60):     plausibility_penalties += 0.10
    if not (0 <= humidity <= 100):  plausibility_penalties += 0.05
    if not (0 <= cloud <= 100):     plausibility_penalties += 0.05
    plausibility = clamp(1.0 - plausibility_penalties)

    confidence = (0.50 * agreement + 0.30 * source_quality + 0.20 * plausibility)
    return round(confidence * 100.0, 1)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — Constraint filtering
# ═══════════════════════════════════════════════════════════════════════════════

class ConstraintViolation(Exception):
    """Raised when a location fails hard constraints and should be rejected early."""
    def __init__(self, reason: str, code: str):
        self.reason = reason
        self.code = code
        super().__init__(reason)


HARD_CONSTRAINTS = {
    "min_solar":      2.0,    # kWh/m²/d — absolute minimum for any solar project
    "max_slope":      25.0,   # degrees — beyond this, terrain is unusable
    "max_cloud":      90.0,   # %       — >90% permanent cloud = no solar
    "max_grid_km":    100.0,  # km      — >100km from grid = unviable small plant
}


def check_constraints(
    solar: float,
    slope: float,
    cloud: float,
    grid_km: float,
    available_area_m2: float,
    plant_size_kw: float,
) -> list[str]:
    """
    Returns a list of constraint violation messages.
    Empty list = all constraints pass.
    """
    violations = []

    if solar < HARD_CONSTRAINTS["min_solar"]:
        violations.append(
            f"Solar irradiance {solar:.1f} kWh/m²/d is below minimum "
            f"({HARD_CONSTRAINTS['min_solar']} kWh/m²/d). Location is not viable."
        )

    if slope > HARD_CONSTRAINTS["max_slope"]:
        violations.append(
            f"Terrain slope {slope:.1f}° exceeds {HARD_CONSTRAINTS['max_slope']}°. "
            f"Ground-mount installation is not feasible."
        )

    if cloud > HARD_CONSTRAINTS["max_cloud"]:
        violations.append(
            f"Cloud cover {cloud:.0f}% is too high for reliable solar generation."
        )

    if grid_km > HARD_CONSTRAINTS["max_grid_km"]:
        violations.append(
            f"Grid distance {grid_km:.0f}km exceeds {HARD_CONSTRAINTS['max_grid_km']}km. "
            f"Grid connection cost makes this unviable."
        )

    required_m2 = plant_size_kw * 8.0
    if available_area_m2 > 0 and required_m2 > 0:
        usage_pct = (required_m2 / available_area_m2) * 100.0
        if available_area_m2 < required_m2:
            violations.append(
                f"Insufficient area: {plant_size_kw:.0f}kW plant needs "
                f"~{required_m2:.0f}m² but only {available_area_m2:.0f}m² is available "
                f"({usage_pct:.0f}% utilisation — exceeds 100%). "
                f"Reduce plant size to ≤{available_area_m2/8.0:.1f}kW or select a larger area."
            )

    return violations


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — Adaptive EMA Calibrator
# ═══════════════════════════════════════════════════════════════════════════════

class AdaptiveCalibrator:
    """
    Regional EMA calibrator.
    Learns actual-vs-predicted bias in 5°×5° grid cells.
    corrected_score = base_score + regional_bias
    where regional_bias = EMA(actual_performance - predicted_score).
    """
    EMA_ALPHA  = 0.12       # slower learning → more stable regional signal
    MAX_ADJUST = 10.0       # ± 10 points maximum adjustment
    MIN_SAMPLES = 5         # need at least 5 data points before applying

    def __init__(self):
        # {region_key: {"ema_score": float, "n": int, "ema_residual": float}}
        self._cache: dict = {}

    def _key(self, lat: float, lng: float) -> str:
        return f"{round(lat/5)*5}_{round(lng/5)*5}"

    def record(self, lat: float, lng: float, score: float) -> None:
        key = self._key(lat, lng)
        if key not in self._cache:
            self._cache[key] = {"ema_score": score, "n": 1, "ema_residual": 0.0}
        else:
            e = self._cache[key]
            e["ema_score"] = self.EMA_ALPHA * score + (1 - self.EMA_ALPHA) * e["ema_score"]
            e["n"] += 1

    def record_residual(self, lat: float, lng: float, actual: float, predicted: float) -> None:
        """Record actual-vs-predicted residual for bias correction."""
        key = self._key(lat, lng)
        entry = self._cache.setdefault(key, {"ema_score": predicted, "n": 0, "ema_residual": 0.0})
        residual = actual - predicted
        entry["ema_residual"] = (
            self.EMA_ALPHA * residual + (1 - self.EMA_ALPHA) * entry["ema_residual"]
        )
        entry["n"] = entry.get("n", 0) + 1

    def adjustment(self, lat: float, lng: float, raw_score: float) -> float:
        key = self._key(lat, lng)
        entry = self._cache.get(key)
        if not entry or entry.get("n", 0) < self.MIN_SAMPLES:
            return 0.0

        # Bias from stored residuals (actual - predicted)
        residual_adj = entry.get("ema_residual", 0.0)
        # Trend from regional EMA vs neutral baseline
        ema_delta = (entry["ema_score"] - 65.0) * 0.20
        combined = residual_adj * 0.6 + ema_delta * 0.4
        return max(-self.MAX_ADJUST, min(self.MAX_ADJUST, combined))

    def regional_stats(self, lat: float, lng: float) -> dict:
        key = self._key(lat, lng)
        entry = self._cache.get(key, {})
        return {
            "region": key,
            "n_analyses": entry.get("n", 0),
            "ema_score": round(entry.get("ema_score", 65.0), 1),
            "ema_residual": round(entry.get("ema_residual", 0.0), 2),
        }

    def load_from_db(self, db_session) -> None:
        try:
            from database import AnalysisResult
            cutoff = datetime.utcnow() - timedelta(days=180)
            rows = (
                db_session.query(
                    AnalysisResult.lat, AnalysisResult.lng, AnalysisResult.score
                )
                .filter(AnalysisResult.created_at >= cutoff)
                .limit(5000)
                .all()
            )
            for lat, lng, score in rows:
                if None not in (lat, lng, score):
                    self.record(float(lat), float(lng), float(score))
            logger.info(
                f"[Calibrator v3] Loaded {len(rows)} analyses over "
                f"{len(self._cache)} regions (180-day window)."
            )
        except Exception as e:
            logger.warning(f"[Calibrator v3] DB bootstrap skipped: {e}")


# Singleton
_calibrator = AdaptiveCalibrator()

def get_calibrator() -> AdaptiveCalibrator:
    return _calibrator


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — Main scoring function
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_score(
    solar_irradiance: float,
    wind_speed: float,
    elevation: float,
    temperature: Optional[float] = None,
    humidity: Optional[float] = None,
    lat: Optional[float] = None,
    # New v3 factors
    cloud_cover_pct: Optional[float] = None,
    slope_degrees: Optional[float] = None,
    grid_distance_km: Optional[float] = None,
    plant_size_kw: Optional[float] = None,
    available_area_m2: Optional[float] = None,
    data_sources: int = 3,
    apply_calibration: bool = True,
    run_constraints: bool = True,
) -> dict:
    """
    Production-grade placement score (0-100) with 8 Gaussian/sigmoid factors.

    Returns rich dict including:
      score, grade, confidence, recommendation, suitability_class,
      factor_scores (per-factor), constraint_violations, calibration_metadata
    """

    # ── Fill defaults for optional inputs ─────────────────────────────────
    _lat       = lat            if lat            is not None else 20.0
    _temp      = temperature    if temperature    is not None else _estimate_temp(_lat)
    _cloud     = cloud_cover_pct if cloud_cover_pct is not None else 40.0
    _slope     = slope_degrees  if slope_degrees  is not None else 3.0
    _grid_km   = grid_distance_km if grid_distance_km is not None else 15.0
    _plant_kw  = plant_size_kw  if plant_size_kw  is not None else 10.0
    _area_m2   = available_area_m2 if available_area_m2 is not None else _plant_kw * 8 * 2

    # ── Constraint check ──────────────────────────────────────────────────
    violations = []
    if run_constraints:
        violations = check_constraints(
            solar_irradiance, _slope, _cloud, _grid_km, _area_m2, _plant_kw
        )

    # ── Per-factor scores [0, 1] ──────────────────────────────────────────
    f = {
        "solar":      score_solar(solar_irradiance),
        "temperature": score_temperature(_temp),
        "elevation":  score_elevation(elevation),
        "wind":       score_wind(wind_speed),
        "cloud":      score_cloud(_cloud),
        "slope":      score_slope(_slope),
        "grid":       score_grid(_grid_km),
        "plant_size": score_plant_size(_plant_kw, _area_m2, solar_irradiance),
    }

    # ── Weighted combination ──────────────────────────────────────────────
    raw_01 = sum(WEIGHTS[k] * v for k, v in f.items())

    # Scale to 0-100 (raw_01 max ≈ 0.97, scale ×105 → high-achievers reach 95+)
    raw_score = round(clamp(raw_01 * 105, 0, 100))

    # ── Adaptive calibration ──────────────────────────────────────────────
    calib_adj = 0.0
    regional_stats_data = {}
    if apply_calibration and lat is not None:
        calib_adj = _calibrator.adjustment(_lat, 0.0, raw_score)
        _calibrator.record(_lat, 0.0, raw_score)
        regional_stats_data = _calibrator.regional_stats(_lat, 0.0)

    final_score = int(clamp(raw_score + calib_adj, 0, 100))

    # ── Confidence ────────────────────────────────────────────────────────
    confidence = calculate_confidence(
        solar=solar_irradiance,
        wind=wind_speed,
        temp=_temp,
        humidity=humidity if humidity is not None else 55.0,
        cloud=_cloud,
        slope=_slope,
        grid_km=_grid_km,
        data_sources=data_sources,
    )

    # ── Suitability class ─────────────────────────────────────────────────
    suitability = get_suitability_class(final_score)

    logger.info(
        f"[SCOREv3] lat={_lat:.2f} solar={solar_irradiance:.2f} wind={wind_speed:.1f} "
        f"elev={elevation:.0f}m temp={_temp:.1f}°C cloud={_cloud:.0f}% "
        f"slope={_slope:.1f}° grid={_grid_km:.0f}km plant={_plant_kw:.0f}kW "
        f"→ raw={raw_score} adj={calib_adj:+.1f} final={final_score} "
        f"conf={confidence}% suitability={suitability}"
    )

    return {
        # Core output
        "score":       final_score,
        "grade":       get_grade(final_score),
        "confidence":  confidence,
        "recommendation": get_recommendation(final_score),
        "suitability_class": suitability,
        "constraint_violations": violations,
        "is_suitable": len(violations) == 0,

        # Per-factor scores (0-100 for display)
        "solar_score":       round(f["solar"]       * 100, 1),
        "temperature_score": round(f["temperature"] * 100, 1),
        "elevation_score":   round(f["elevation"]   * 100, 1),
        "wind_score":        round(f["wind"]         * 100, 1),
        "cloud_score":       round(f["cloud"]        * 100, 1),
        "slope_score":       round(f["slope"]        * 100, 1),
        "grid_score":        round(f["grid"]         * 100, 1),
        "plant_size_score":  round(f["plant_size"]   * 100, 1),

        # Calibration metadata
        "calibration_adjustment": round(calib_adj, 2),
        "regional_stats": regional_stats_data,
        "algorithm_version": "v3-production",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 7 — Grade / Suitability / Recommendation helpers
# ═══════════════════════════════════════════════════════════════════════════════

def get_grade(score: int) -> str:
    if score >= 88: return "A+"
    if score >= 78: return "A"
    if score >= 68: return "B+"
    if score >= 58: return "B"
    if score >= 47: return "C"
    if score >= 35: return "D"
    return "F"


def get_suitability_class(score: int) -> str:
    if score >= 80: return "Excellent"
    if score >= 65: return "Good"
    if score >= 50: return "Moderate"
    if score >= 35: return "Poor"
    return "Unsuitable"


def get_recommendation(score: int) -> str:
    if score >= 85:
        return "Exceptional — Top-tier solar site. Maximum ROI expected with minimal risk."
    if score >= 75:
        return "Highly Recommended — Excellent solar potential. Fast payback, high lifetime returns."
    if score >= 65:
        return "Recommended — Good conditions for solar installation with solid returns."
    if score >= 55:
        return "Promising — Above-average potential. Standard installation will be profitable."
    if score >= 45:
        return "Moderate — Acceptable conditions. Consider premium panels for better yield."
    if score >= 35:
        return "Marginal — Limited potential. Evaluate shading, orientation and hybrid options."
    return "Not Recommended — Poor solar resource. High investment risk."


# ── Utility fallbacks ─────────────────────────────────────────────────────────
def _estimate_temp(lat: float) -> float:
    a = abs(lat)
    if a <= 10:  return 28.0
    if a <= 20:  return 26.0
    if a <= 30:  return 24.0
    if a <= 40:  return 18.0
    if a <= 50:  return 10.0
    if a <= 60:  return 4.0
    return -5.0
