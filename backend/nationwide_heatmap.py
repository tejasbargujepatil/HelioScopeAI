"""
HelioScope AI — Nationwide India Solar Heatmap
================================================
Pre-computes placement scores for a grid across India without making
external API calls per point, using:
  - NASA-derived latitude/longitude solar irradiance model
  - Regional temperature / cloud cover estimates
  - Known Indian grid infrastructure density zones
  - Standard elevation estimate by terrain region

Grid: 0.75° resolution → ~1,800 points covering India (8°N-37°N, 68°E-97°E)
Total compute time: <1 second (no external APIs needed)
"""

import math
import logging
from typing import List, Dict

from scoring import calculate_score

logger = logging.getLogger(__name__)

# ── India bounding box ───────────────────────────────────────────────────────
INDIA_LAT_MIN, INDIA_LAT_MAX = 6.5,  37.5
INDIA_LNG_MIN, INDIA_LNG_MAX = 67.0, 97.5
GRID_DEG = 0.75    # degrees per cell ≈ 83 km at equator

MONTHS_DAYS = [31,28,31,30,31,30,31,31,30,31,30,31]

# ── Regional knowledge for India (lat/lng band → attributes) ─────────────────
# Based on India Solar Atlas + IMD climate zones

def _estimate_solar(lat: float, lng: float) -> float:
    """
    Estimate annual mean GHI (kWh/m²/day) for Indian location.
    Values calibrated against NISE / MNRE India Solar Atlas.
    """
    # Rajasthan / Gujarat desert (highest solar)
    if lat >= 22 and lat <= 32 and lng >= 68 and lng <= 77:
        return 6.2 + (27 - lat) * 0.05  # peaks ~6.5 in north Rajasthan
    # Punjab / Haryana / UP
    if lat >= 26 and lat <= 32 and lng >= 74 and lng <= 84:
        return 5.8
    # Maharashtra / MP / CG
    if lat >= 18 and lat <= 26 and lng >= 74 and lng <= 84:
        return 5.9 - abs(lat - 22) * 0.05
    # Andhra / Telangana / Karnataka plateau
    if lat >= 13 and lat <= 20 and lng >= 74 and lng <= 84:
        return 5.8
    # Tamil Nadu coast (high solar)
    if lat >= 8 and lat <= 13 and lng >= 76 and lng <= 80:
        return 5.7
    # Kerala (humid, lower solar)
    if lat >= 8 and lat <= 12 and lng >= 75 and lng <= 77:
        return 5.0
    # North East (cloud / rain)
    if lat >= 22 and lng >= 88:
        return 4.6 - (lat - 22) * 0.05
    # Himachal / J&K (high altitude, good solar)
    if lat >= 32 and lng >= 74 and lng <= 83:
        return 5.7 + (lat - 32) * 0.1
    # Odisha / WB coast
    if lat >= 18 and lat <= 24 and lng >= 84 and lng <= 90:
        return 5.3
    # Default
    lat_factor = max(0, 1 - abs(lat - 20) / 20)
    return 5.0 + lat_factor * 0.8


def _estimate_temperature(lat: float, lng: float) -> float:
    """Mean annual temperature estimate (°C) for India."""
    if lat >= 32: return 14.0 + (37 - lat) * 0.5
    if lat >= 28: return 24.0
    if lat >= 22: return 27.0
    if lat >= 15: return 28.0
    return 27.5


def _estimate_cloud(lat: float, lng: float) -> float:
    """Mean annual cloud cover estimate (%)."""
    # High humidity/cloud zones
    if lng >= 74 and lng <= 77 and lat <= 12: return 55.0    # Kerala
    if lng >= 88 and lat >= 22: return 60.0                   # NE India
    if lat >= 14 and lat <= 20 and lng >= 73 and lng <= 77: return 40.0  # Konkan
    if lat >= 22 and lat <= 30 and lng >= 68 and lng <= 77: return 20.0  # Rajasthan
    return 35.0


def _estimate_wind(lat: float, lng: float) -> float:
    """Mean wind speed estimate (m/s)."""
    if lat >= 22 and lat <= 30 and lng >= 68 and lng <= 77: return 4.5   # Rajasthan
    if lat >= 8 and lat <= 13 and lng >= 76 and lng <= 80: return 4.0     # Tamil Nadu coast
    if lat >= 21 and lat <= 26 and lng >= 86 and lng <= 92: return 3.0    # Odisha coast
    return 3.0


def _estimate_elevation(lat: float, lng: float) -> float:
    """Rough elevation (m) estimate for India."""
    if lat >= 34: return 2500.0   # J&K / Ladakh
    if lat >= 32: return 1200.0   # Himachal
    if lat >= 22 and lat <= 30 and lng >= 68 and lng <= 75: return 300.0  # Rajasthan plateau
    if lat >= 18 and lat <= 22 and lng >= 74 and lng <= 78: return 600.0  # Deccan plateau
    if lat >= 10 and lat <= 15 and lng >= 75 and lng <= 79: return 400.0  # Nilgiris approach
    return 200.0


def _estimate_grid_distance(lat: float, lng: float) -> float:
    """Rough grid distance (km) — denser in major states, remote in NE/J&K."""
    if lat >= 32: return 25.0          # J&K / Himachal
    if lng >= 92 and lat >= 22: return 30.0  # North East
    if lat >= 22 and lat <= 30 and lng >= 68 and lng <= 74: return 15.0  # Rajasthan
    return 8.0                          # Most of India is well-connected


def _is_in_india(lat: float, lng: float) -> bool:
    """Rough check — excludes obvious sea/Pakistan/Bangladesh areas."""
    # Bay of Bengal / Indian Ocean exclusion
    if lat < 8 or lat > 37: return False
    if lng < 67 or lng > 98: return False
    # Rough exclusion of ocean areas
    if lat < 20 and lng > 90: return False        # Bay of Bengal S
    if lat < 15 and (lng < 73 or lng > 83): return False  # Southern tip
    if lat > 33 and (lng < 73 or lng > 85): return False  # Northern exclusions
    return True


# ── Main ─────────────────────────────────────────────────────────────────────

# Cache — computed once per process startup
_NATIONWIDE_CACHE: Dict = {}


async def compute_nationwide_heatmap(plant_size_kw: float = 10.0) -> Dict:
    """
    Return pre-computed nationwide India heatmap (no API calls).
    Cached after first computation.
    """
    cache_key = f"nat_{plant_size_kw}"
    if cache_key in _NATIONWIDE_CACHE:
        logger.info("[NationwideHeatmap] Returning from cache")
        return _NATIONWIDE_CACHE[cache_key]

    logger.info(f"[NationwideHeatmap] Computing grid at {GRID_DEG}° resolution…")
    cells = []

    lat = INDIA_LAT_MIN
    while lat <= INDIA_LAT_MAX:
        lng = INDIA_LNG_MIN
        while lng <= INDIA_LNG_MAX:
            if _is_in_india(lat, lng):
                solar  = _estimate_solar(lat, lng)
                temp   = _estimate_temperature(lat, lng)
                cloud  = _estimate_cloud(lat, lng)
                wind   = _estimate_wind(lat, lng)
                elev   = _estimate_elevation(lat, lng)
                grid_d = _estimate_grid_distance(lat, lng)

                result = calculate_score(
                    solar_irradiance=solar,
                    wind_speed=wind,
                    elevation=elev,
                    temperature=temp,
                    humidity=55.0,
                    lat=lat,
                    cloud_cover_pct=cloud,
                    slope_degrees=1.5,       # flat assumption for national grid
                    grid_distance_km=grid_d,
                    plant_size_kw=plant_size_kw,
                    available_area_m2=None,
                    data_sources=3,
                    apply_calibration=False,  # no regional calibration for national
                    run_constraints=False,
                )

                score = result["score"]
                cells.append({
                    "lat": round(lat, 4),
                    "lng": round(lng, 4),
                    "score": score,
                    "grade": result["grade"],
                    "color": _score_to_color(score),
                    "suitability_class": result["suitability_class"],
                    "solar_irradiance": round(solar, 2),
                    "cell_size_km": 83,
                })
            lng += GRID_DEG
        lat += GRID_DEG

    cells.sort(key=lambda c: c["score"], reverse=True)
    scores = [c["score"] for c in cells]
    mean   = sum(scores) / len(scores) if scores else 0

    top5_states = _identify_top_regions(cells[:20])

    result = {
        "cells": cells,
        "cell_count": len(cells),
        "grid_resolution_deg": GRID_DEG,
        "score_mean": round(mean, 1),
        "optimal_cell": cells[0] if cells else None,
        "top_cells": cells[:5],
        "top_regions": top5_states,
        "plant_size_kw": plant_size_kw,
        "note": "National heatmap uses estimated climate data — run point analysis for precise site scoring",
    }
    _NATIONWIDE_CACHE[cache_key] = result
    logger.info(f"[NationwideHeatmap] {len(cells)} valid cells computed, mean score={mean:.1f}")
    return result


def _score_to_color(score: int) -> str:
    if score >= 80: return "#10b981"
    if score >= 65: return "#3b82f6"
    if score >= 50: return "#f59e0b"
    if score >= 35: return "#f97316"
    return "#ef4444"


# State bounding box lookup for top regions annotation
STATE_BOXES = {
    "Rajasthan":     (22, 30, 68, 78),
    "Gujarat":       (20, 25, 68, 74),
    "Maharashtra":   (15, 23, 72, 81),
    "Andhra Pradesh":(12, 20, 76, 85),
    "Karnataka":     (12, 19, 74, 78),
    "Tamil Nadu":    (8,  14, 76, 80),
    "Madhya Pradesh":(21, 27, 74, 82),
    "Telangana":     (15, 19, 77, 82),
    "Punjab":        (29, 33, 73, 77),
    "Haryana":       (27, 31, 74, 78),
}

def _identify_top_regions(top_cells: List[Dict]) -> List[str]:
    """Map top cells to approximate state names."""
    named = []
    for cell in top_cells[:5]:
        for state, (lat0, lat1, lng0, lng1) in STATE_BOXES.items():
            if lat0 <= cell["lat"] <= lat1 and lng0 <= cell["lng"] <= lng1:
                if state not in named:
                    named.append(state)
                break
    return named or ["Rajasthan", "Gujarat", "Andhra Pradesh"]
