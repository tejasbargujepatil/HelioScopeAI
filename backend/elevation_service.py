"""
HelioScope AI — Elevation & Slope Service v2
Fetches elevation (m) and estimates terrain slope (°) for placement scoring.

Slope estimation uses a 4-point cardinal gradient:
  sample elevations 200m N/S/E/W of the point,
  compute rise/run, convert to degrees.
"""

import os
import httpx
import logging
import math

logger = logging.getLogger(__name__)

GOOGLE_ELEVATION_URL  = "https://maps.googleapis.com/maps/api/elevation/json"
OPEN_ELEVATION_URL    = "https://api.open-elevation.com/api/v1/lookup"

# 200m offset in degrees (≈ 0.0018° at equator)
SLOPE_OFFSET_DEG = 0.0018


async def fetch_elevation_and_slope(lat: float, lng: float) -> dict:
    """
    Returns {"elevation": float (m), "slope_degrees": float (°)}.

    Elevation: Google Maps API → Open-Elevation → region estimate.
    Slope: 5-point stencil (centre + 4 cardinal neighbours) → terrain gradient.
    """
    points = [
        (lat, lng),                          # centre
        (lat + SLOPE_OFFSET_DEG, lng),        # N
        (lat - SLOPE_OFFSET_DEG, lng),        # S
        (lat, lng + SLOPE_OFFSET_DEG),        # E
        (lat, lng - SLOPE_OFFSET_DEG),        # W
    ]

    elevations = await _batch_elevation(points)
    centre_elev = elevations[0]
    n, s, e, w  = elevations[1], elevations[2], elevations[3], elevations[4]

    # 200m spacing → rise/run → degrees
    spacing_m = SLOPE_OFFSET_DEG * 111_000   # metres per degree (approx)
    dz_ns = abs(n - s) / (2 * spacing_m)
    dz_ew = abs(e - w) / (2 * spacing_m)
    gradient = math.sqrt(dz_ns**2 + dz_ew**2)
    slope_deg = round(math.degrees(math.atan(gradient)), 2)

    logger.info(
        f"Elevation: {centre_elev:.1f}m  Slope: {slope_deg:.1f}° "
        f"(lat={lat}, lng={lng})"
    )

    return {
        "elevation":     round(centre_elev, 1),
        "slope_degrees": slope_deg,
    }


async def fetch_elevation(lat: float, lng: float) -> float:
    """Legacy shim — returns just elevation."""
    result = await fetch_elevation_and_slope(lat, lng)
    return result["elevation"]


# ── Internal batch elevation fetcher ─────────────────────────────────────────

async def _batch_elevation(points: list[tuple]) -> list[float]:
    """Fetch elevation for a list of (lat, lng) points."""
    api_key = os.getenv("GOOGLE_ELEVATION_API_KEY", "").strip()

    # ── 1. Google Maps (supports batch) ──────────────────────────────────
    if api_key:
        try:
            locations = "|".join(f"{lat},{lng}" for lat, lng in points)
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.get(
                    GOOGLE_ELEVATION_URL,
                    params={"locations": locations, "key": api_key},
                )
                resp.raise_for_status()
                data = resp.json()
                if data.get("status") == "OK":
                    return [float(r["elevation"]) for r in data["results"]]
        except Exception as e:
            logger.warning(f"Google Elevation batch failed ({e}).")

    # ── 2. Open-Elevation (batch POST) ───────────────────────────────────
    try:
        payload = {"locations": [{"latitude": lat, "longitude": lng}
                                  for lat, lng in points]}
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(OPEN_ELEVATION_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return [float(r["elevation"]) for r in data["results"]]
    except Exception as e:
        logger.warning(f"Open-Elevation batch failed ({e}), using region estimates.")

    # ── 3. Fallback — region estimates for all points ─────────────────────
    return [_estimate_elevation(lat, lng) for lat, lng in points]


def _estimate_elevation(lat: float, lng: float) -> float:
    if 28 <= lat <= 40 and 75 <= lng <= 105:  return 3500.0  # Himalayas
    if 8  <= lat <= 37 and 68 <= lng <= 97:   return 400.0   # India
    if -55 <= lat <= 10 and -80 <= lng <= -60: return 1500.0  # Andes
    if 30 <= lat <= 60 and -125 <= lng <= -90: return 700.0   # N America
    if 44 <= lat <= 48 and 6 <= lng <= 16:    return 1200.0  # Alps
    return 150.0   # coastal / lowland default
