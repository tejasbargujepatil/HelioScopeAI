"""
HelioScope AI — Seasonal Solar Time-Series Service
===================================================
Fetches month-wise solar irradiance from NASA POWER monthly climatology API.
Computes seasonal stability index and estimates monthly generation per kWp.

NASA POWER climatology endpoint returns long-term monthly averages (22 years).
This is the standard approach used by NREL, SolarEdge, Aurora Solar, etc.
"""

import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

# NASA POWER monthly climatology endpoint
NASA_MONTHLY_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"

# Month names for display
MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# System efficiency (same as roi.py)
EFFICIENCY_FACTOR = 0.80
DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


async def fetch_monthly_solar(lat: float, lng: float) -> list[float]:
    """
    Fetch 12-month long-term average solar irradiance from NASA POWER.
    Returns list of 12 floats [Jan..Dec] in kWh/m²/day.
    Falls back to latitude-based seasonal model if API fails.
    """
    params = {
        "parameters": "ALLSKY_SFC_SW_DWN",
        "community": "RE",
        "longitude": lng,
        "latitude": lat,
        "format": "JSON",
        "header": "false",
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(NASA_MONTHLY_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
            monthly_raw = data["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]

            # NASA returns dict with keys "JAN", "FEB", ... "DEC", "ANN"
            month_keys = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                          "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
            values = []
            for key in month_keys:
                v = monthly_raw.get(key, -999)
                if v == -999 or v < 0:
                    v = _latitude_estimate(lat, month_keys.index(key))
                values.append(round(float(v), 2))

            logger.info(f"[Seasonal] NASA monthly data: {values}")
            return values

    except Exception as e:
        logger.warning(f"[Seasonal] NASA monthly fetch failed: {e}. Using latitude model.")
        return [_latitude_estimate(lat, m) for m in range(12)]


def _latitude_estimate(lat: float, month_idx: int) -> float:
    """
    Latitude-based monthly irradiance model.
    Uses a sinusoidal approximation: higher in summer (for northern hemisphere).
    """
    abs_lat = abs(lat)
    # Annual average based on latitude
    if abs_lat < 15:
        annual = 6.2
    elif abs_lat < 25:
        annual = 5.8
    elif abs_lat < 35:
        annual = 5.2
    elif abs_lat < 45:
        annual = 4.5
    elif abs_lat < 55:
        annual = 3.5
    else:
        annual = 2.5

    # Seasonal amplitude — more variation at higher latitudes
    amplitude = 0.1 + abs_lat / 90.0 * 1.8

    # Northern hemisphere: peak in June (month 5), trough in December (month 11)
    # Southern hemisphere: inverted
    if lat >= 0:
        phase = month_idx  # 0=Jan peak shift
        seasonal = math.sin(math.pi * (phase - 1) / 6.0)  # +1 in June, -1 in Dec
    else:
        seasonal = -math.sin(math.pi * (month_idx - 1) / 6.0)

    value = annual + amplitude * seasonal
    return round(max(0.5, value), 2)


import math  # moved after function to avoid top-level import conflict


def compute_seasonal_stats(
    monthly_irradiance: list[float],
    plant_size_kw: float = 10.0,
) -> dict:
    """
    Compute seasonal statistics from 12-month irradiance data.

    Returns:
      monthly_generation_kwh: energy per month for given plant size
      annual_total_kwh: sum of monthly generation
      stability_index: 1 - CoV (0=unstable, 1=perfectly stable)
      peak_month: best production month
      low_month: worst production month
      monthly_summary: list of {month, irradiance, generation_kwh, days}
    """
    avg = sum(monthly_irradiance) / 12
    if avg == 0:
        return {}

    # Coefficient of Variation (CoV) = stdev / mean
    variance = sum((x - avg) ** 2 for x in monthly_irradiance) / 12
    std_dev = math.sqrt(variance)
    cov = std_dev / avg if avg > 0 else 0
    stability_index = round(max(0.0, 1.0 - cov), 3)

    # Monthly generation: kW × irradiance × days × efficiency
    monthly_gen = []
    for i, irr in enumerate(monthly_irradiance):
        days = DAYS_PER_MONTH[i]
        gen = round(plant_size_kw * irr * days * EFFICIENCY_FACTOR, 1)
        monthly_gen.append(gen)

    annual_total = round(sum(monthly_gen), 1)

    peak_idx = monthly_irradiance.index(max(monthly_irradiance))
    low_idx  = monthly_irradiance.index(min(monthly_irradiance))

    summary = [
        {
            "month": MONTH_NAMES[i],
            "month_idx": i + 1,
            "irradiance_kwh_m2_day": monthly_irradiance[i],
            "generation_kwh": monthly_gen[i],
            "days": DAYS_PER_MONTH[i],
        }
        for i in range(12)
    ]

    return {
        "monthly_irradiance":      monthly_irradiance,
        "monthly_generation_kwh":  monthly_gen,
        "annual_total_kwh":        annual_total,
        "avg_irradiance":          round(avg, 2),
        "stability_index":         stability_index,
        "cov_pct":                 round(cov * 100, 1),
        "peak_month":              MONTH_NAMES[peak_idx],
        "peak_irradiance":         monthly_irradiance[peak_idx],
        "low_month":               MONTH_NAMES[low_idx],
        "low_irradiance":          monthly_irradiance[low_idx],
        "monthly_summary":         summary,
    }


async def get_seasonal_analysis(
    lat: float, lng: float, plant_size_kw: float = 10.0
) -> dict:
    """Full seasonal analysis pipeline: fetch → compute → return."""
    monthly = await fetch_monthly_solar(lat, lng)
    stats = compute_seasonal_stats(monthly, plant_size_kw)
    return stats
