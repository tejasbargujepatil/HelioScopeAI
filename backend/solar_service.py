"""
HelioScope AI — Solar Data Service
Fetches solar irradiance from NASA POWER API (daily/point endpoint).
Uses a 30-day window of recent data and averages for a reliable result.
"""

import httpx
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

POWER_DAILY_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
POWER_CLIMATOLOGY_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"


def _date_range_params() -> tuple[str, str]:
    """Return (start, end) date strings for the last 365 days."""
    end_dt = datetime.utcnow() - timedelta(days=2)   # POWER lags ~2 days
    start_dt = end_dt - timedelta(days=364)
    return start_dt.strftime("%Y%m%d"), end_dt.strftime("%Y%m%d")


async def fetch_solar_irradiance(lat: float, lng: float) -> float:
    """
    Fetch average daily solar irradiance (kWh/m²/day) from NASA POWER API.

    Primary: temporal/daily/point  (last 12 months, parameter: ALLSKY_SFC_SW_DWN)
    Fallback: temporal/climatology/point  (long-term annual average)
    Final fallback: latitude-based estimate
    """
    # ── 1st attempt: daily endpoint (last 365 days) ────────────────────────
    start, end = _date_range_params()
    daily_params = {
        "parameters": "ALLSKY_SFC_SW_DWN",
        "community": "RE",
        "longitude": round(lng, 4),
        "latitude": round(lat, 4),
        "start": start,
        "end": end,
        "format": "JSON",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(POWER_DAILY_URL, params=daily_params)
            resp.raise_for_status()
            data = resp.json()

            values = list(
                data["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"].values()
            )
            # POWER uses -999 as fill value for missing data
            valid = [v for v in values if v not in (-999, -999.0, None)]
            if valid:
                avg = sum(valid) / len(valid)
                logger.info(f"NASA POWER daily: {avg:.3f} kWh/m²/d "
                            f"({len(valid)} days, lat={lat}, lng={lng})")
                return round(avg, 3)

    except Exception as e:
        logger.warning(f"NASA POWER daily endpoint failed ({e}), trying climatology...")

    # ── 2nd attempt: climatology endpoint (long-term annual average) ───────
    clim_params = {
        "parameters": "ALLSKY_SFC_SW_DWN",
        "community": "RE",
        "longitude": round(lng, 4),
        "latitude": round(lat, 4),
        "format": "JSON",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(POWER_CLIMATOLOGY_URL, params=clim_params)
            resp.raise_for_status()
            data = resp.json()

            irradiance = (
                data["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]["ANN"]
            )
            logger.info(f"NASA POWER climatology: {irradiance:.3f} kWh/m²/d "
                        f"(lat={lat}, lng={lng})")
            return round(float(irradiance), 3)

    except Exception as e:
        logger.warning(f"NASA POWER climatology failed ({e}), using estimate.")

    # ── Final fallback: latitude-based estimate ────────────────────────────
    estimate = _estimate_solar_irradiance(lat)
    logger.warning(f"Using latitude estimate: {estimate} kWh/m²/d")
    return estimate


def _estimate_solar_irradiance(lat: float) -> float:
    abs_lat = abs(lat)
    if abs_lat <= 15:   return 6.5    # Tropical
    elif abs_lat <= 30: return 5.5    # Subtropical (India, N. Africa)
    elif abs_lat <= 45: return 4.0    # Temperate
    elif abs_lat <= 60: return 2.5    # Subarctic
    else:               return 1.5    # Arctic
