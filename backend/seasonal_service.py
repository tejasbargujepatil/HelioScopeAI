"""
HelioScope AI — Seasonal Time-Series Service
=============================================
Fetches month-wise solar irradiance from NASA POWER climatology endpoint,
computes generation estimates per month, and calculates a seasonal
stability index (coefficient of variation).
"""

import math
import logging
import httpx
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
NASA_BASE = "https://power.larc.nasa.gov/api"
TIMEOUT   = 20.0

# Performance factor (same as ROI engine)
PERF_RATIO = 0.80
DAYS_PER_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31]


async def fetch_monthly_irradiance(lat: float, lng: float) -> Dict:
    """
    Fetch monthly-average solar irradiance for every calendar month.
    Uses NASA POWER climatology (long-term average, fast, no date params).

    Returns:
        {
            monthly_irradiance: [float × 12],   # kWh/m²/day per month
            monthly_generation_kwh: [float × 12],  # for given plant_size_kw
            annual_total_kwh: float,
            peak_month: str,
            trough_month: str,
            stability_index: float,   # 0-1 (1=very stable, 0=highly variable)
            cv_percent: float,        # coefficient of variation %
            months: [str × 12],
        }
    """
    url = (
        f"{NASA_BASE}/temporal/climatology/point"
        f"?parameters=ALLSKY_SFC_SW_DWN"
        f"&community=RE&longitude={lng}&latitude={lat}"
        f"&format=JSON"
    )

    irr = None
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()
            props = data.get("properties", {}).get("parameter", {})
            raw = props.get("ALLSKY_SFC_SW_DWN", {})
            # Climatology keys: "JAN","FEB",..."DEC" (+ "ANN")
            irr = [
                float(raw.get(m.upper(), -999))
                for m in MONTHS
            ]
            # Filter fill values
            irr = [max(0.0, v) if v > -900 else None for v in irr]
    except Exception as e:
        logger.warning(f"[Seasonal] NASA climatology failed ({e}), estimating.")

    # Fallback: latitude-based model
    if irr is None or any(v is None for v in irr):
        irr = _estimate_monthly(lat)

    return _build_response(irr)


def _estimate_monthly(lat: float) -> List[float]:
    """
    Simple sinusoidal model for monthly irradiance:
      • Annual mean from latitude band
      • Seasonal amplitude peaks in summer (December for southern hemisphere)
    """
    abs_lat = abs(lat)
    if abs_lat < 15:   annual_mean = 6.2
    elif abs_lat < 25: annual_mean = 6.0
    elif abs_lat < 35: annual_mean = 5.5
    elif abs_lat < 50: annual_mean = 4.5
    else:               annual_mean = 3.0
    amplitude = annual_mean * 0.3

    # Summer = month 6 (Jun) for N hemisphere, month 12 (Dec) for S
    summer_month = 6 if lat >= 0 else 12

    monthly = []
    for m in range(1, 13):
        phase = 2 * math.pi * (m - summer_month) / 12
        monthly.append(round(annual_mean + amplitude * math.cos(phase), 2))
    return monthly


def _build_response(irr: List[float]) -> Dict:
    """Build the full seasonal response dict from monthly irradiance array."""
    mean_irr = sum(irr) / 12
    std_dev  = math.sqrt(sum((x - mean_irr) ** 2 for x in irr) / 12)
    cv       = (std_dev / mean_irr * 100) if mean_irr > 0 else 0.0
    stability = round(max(0.0, 1.0 - cv / 50) * 100, 1)   # normalise to 0-100

    # Monthly generation (kWh) for 1 kW plant (scale by actual kW on front-end)
    monthly_gen_per_kw = [
        round(irr[i] * DAYS_PER_MONTH[i] * PERF_RATIO, 1)
        for i in range(12)
    ]
    annual_per_kw = round(sum(monthly_gen_per_kw), 1)

    peak_idx   = irr.index(max(irr))
    trough_idx = irr.index(min(irr))

    return {
        "monthly_irradiance":      [round(v, 2) for v in irr],
        "monthly_gen_kwh_per_kw":  monthly_gen_per_kw,   # multiply by plant_size_kw
        "annual_kwh_per_kw":       annual_per_kw,
        "peak_month":              MONTHS[peak_idx],
        "trough_month":            MONTHS[trough_idx],
        "peak_irradiance":         round(max(irr), 2),
        "trough_irradiance":       round(min(irr), 2),
        "annual_mean_irradiance":  round(mean_irr, 2),
        "stability_index":         stability,             # 0-100 (100=very stable)
        "cv_percent":              round(cv, 1),
        "months":                  MONTHS,
    }
