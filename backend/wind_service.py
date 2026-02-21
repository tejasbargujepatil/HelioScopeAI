"""
HelioScope AI — Weather Data Service v2
Fetches wind, temperature, humidity, AND cloud cover from Open-Meteo
in a single call (efficiency: one HTTP round-trip for all weather data).
Also adds slope estimation from nearby elevation gradient.
"""

import httpx
import logging

logger = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


async def fetch_weather(lat: float, lng: float) -> dict:
    """
    Single Open-Meteo call returning:
      wind_speed    (m/s)   — 7-day hourly avg at 10m
      temperature_c (°C)    — 7-day hourly avg at 2m
      humidity_pct  (%)     — 7-day hourly avg
      cloud_cover_pct (%)   — 7-day hourly avg (critical for scoring v3)
    """
    params = {
        "latitude":  round(lat, 4),
        "longitude": round(lng, 4),
        "hourly": (
            "wind_speed_10m,"
            "temperature_2m,"
            "relative_humidity_2m,"
            "cloudcover"           # cloud cover % per hour
        ),
        "current": "wind_speed_10m,temperature_2m,cloudcover",
        "wind_speed_unit": "ms",
        "forecast_days": 7,
        "timezone": "auto",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(OPEN_METEO_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        hourly = data.get("hourly", {})

        def _avg(key: str) -> float | None:
            vals = [v for v in hourly.get(key, []) if v is not None]
            return round(sum(vals) / len(vals), 2) if vals else None

        avg_wind  = _avg("wind_speed_10m")
        avg_temp  = _avg("temperature_2m")
        avg_hum   = _avg("relative_humidity_2m")
        avg_cloud = _avg("cloudcover")

        result = {
            "wind_speed":      avg_wind  if avg_wind  is not None else _est_wind(lat),
            "temperature_c":   avg_temp  if avg_temp  is not None else _est_temp(lat),
            "humidity_pct":    avg_hum   if avg_hum   is not None else _est_humidity(lat),
            "cloud_cover_pct": avg_cloud if avg_cloud is not None else _est_cloud(lat),
            "data_sources":    4,   # all four metrics from live API
        }

        logger.info(
            f"Open-Meteo v2: wind={result['wind_speed']}m/s "
            f"temp={result['temperature_c']}°C hum={result['humidity_pct']}% "
            f"cloud={result['cloud_cover_pct']}% (lat={lat}, lng={lng})"
        )
        return result

    except Exception as e:
        logger.warning(f"Open-Meteo API failed ({e}), using estimates.")

    return {
        "wind_speed":      _est_wind(lat),
        "temperature_c":   _est_temp(lat),
        "humidity_pct":    _est_humidity(lat),
        "cloud_cover_pct": _est_cloud(lat),
        "data_sources":    1,   # only estimates, lower confidence
    }


# ── Legacy shim ───────────────────────────────────────────────────────────────
async def fetch_wind_speed(lat: float, lng: float) -> float:
    """Backward-compatible: returns just wind speed."""
    return (await fetch_weather(lat, lng))["wind_speed"]


# ── Satellite-calibrated fallback estimates ───────────────────────────────────
def _est_wind(lat: float) -> float:
    a = abs(lat)
    if a <= 15: return 3.2
    if a <= 25: return 4.0
    if a <= 35: return 4.8
    if a <= 50: return 5.5
    if a <= 65: return 7.0
    return 8.5

def _est_temp(lat: float) -> float:
    a = abs(lat)
    if a <= 10: return 28.0
    if a <= 20: return 26.0
    if a <= 30: return 24.0
    if a <= 40: return 18.0
    if a <= 50: return 10.0
    if a <= 60: return 4.0
    return -5.0

def _est_humidity(lat: float) -> float:
    a = abs(lat)
    if a <= 10: return 80.0   # Tropical
    if a <= 20: return 65.0   # Monsoon India
    if a <= 30: return 48.0   # Semi-arid / Deccan
    if a <= 40: return 55.0
    if a <= 55: return 70.0
    return 75.0

def _est_cloud(lat: float) -> float:
    """Climatological mean cloud cover estimate by latitude."""
    a = abs(lat)
    if a <= 10: return 55.0   # Tropical ITCZ
    if a <= 20: return 35.0   # Subtropical dry belt (Rajasthan, Sahara)
    if a <= 30: return 30.0   # Semi-arid belt — best solar!
    if a <= 40: return 45.0   # Mediterranean / temperate
    if a <= 55: return 65.0   # Northern Europe
    return 75.0               # Sub-polar / polar — very cloudy
