"""
HelioScope AI — Energy Dashboard Engine
Generates simulated (but realistic) solar energy data for IoT dashboard features.
Uses actual solar irradiance patterns and location-aware calculations.
"""

import math
import random
from datetime import datetime, timezone

# India grid CO2 emission factor (kg CO2e / kWh) — CEA 2024-25
CO2_KG_PER_KWH_INDIA = 0.82

# Average household consumption (kWh/day) — urban India
HOUSEHOLD_KWH_DAY = 10.0


# ── 24-hour solar irradiance curve (normalised, 0-1) ─────────────────────────
# Follows a sunrise-to-sunset bell curve (approx. 6 AM to 7 PM in India)
def _solar_curve(hour: int, peak_hour: int = 13) -> float:
    """Returns a 0-1 irradiance factor for a given hour (0-23)."""
    if hour < 6 or hour > 19:
        return 0.0
    x = (hour - peak_hour) / 4.0
    return max(0.0, math.exp(-x * x))


def generate_24h_energy(
    solar_irradiance: float,
    panel_area: float,
    efficiency: float,
    date: datetime | None = None,
) -> list[dict]:
    """
    Generate a realistic 24-hour hourly energy production profile.

    Returns list of 24 dicts: { hour, time_label, energy_kwh, power_kw }
    Includes small random noise (±5%) to look realistic.
    """
    records = []
    for h in range(24):
        curve = _solar_curve(h)
        noise = 1 + random.uniform(-0.05, 0.05) if curve > 0 else 0
        power_kw = solar_irradiance * panel_area * efficiency * curve * noise
        energy_kwh = power_kw  # per hour
        records.append({
            "hour": h,
            "time": f"{h:02d}:00",
            "power_kw": round(power_kw, 3),
            "energy_kwh": round(energy_kwh, 3),
        })
    return records


def predict_7day_energy(
    solar_irradiance: float,
    panel_area: float,
    efficiency: float,
) -> list[dict]:
    """
    Predict daily energy output for the next 7 days.
    Uses solar irradiance with day-to-day weather variance (±10%).
    """
    from datetime import timedelta
    today = datetime.now(timezone.utc)
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    results = []
    for i in range(7):
        day = today + timedelta(days=i)
        # Simulate cloud/weather variance
        weather_factor = random.uniform(0.7, 1.1)
        daily_kwh = solar_irradiance * panel_area * efficiency * 5.5 * weather_factor  # 5.5 peak-sun-hours
        weather_label = "Sunny" if weather_factor > 0.95 else ("Partly Cloudy" if weather_factor > 0.8 else "Cloudy")
        results.append({
            "day": day_names[day.weekday()],
            "date": day.strftime("%b %d"),
            "energy_kwh": round(daily_kwh, 1),
            "weather": weather_label,
            "weather_factor": round(weather_factor, 2),
        })
    return results


def calculate_surplus(
    energy_kwh_day: float,
    household_kwh_day: float = HOUSEHOLD_KWH_DAY,
) -> dict:
    """
    Calculate surplus or deficit energy compared to household consumption.

    Returns:
        surplus_kwh: positive = can sell to grid, negative = still importing
        self_sufficiency_pct: % of household need covered by solar
        grid_export_kwh: energy available for P2P sale or net metering
    """
    surplus = energy_kwh_day - household_kwh_day
    sufficiency = min(100.0, (energy_kwh_day / household_kwh_day) * 100)
    return {
        "solar_kwh":             round(energy_kwh_day, 2),
        "household_kwh":         round(household_kwh_day, 2),
        "surplus_kwh":           round(surplus, 2),
        "is_surplus":            surplus > 0,
        "self_sufficiency_pct":  round(sufficiency, 1),
        "grid_export_kwh":       round(max(0, surplus), 2),
        "grid_import_kwh":       round(max(0, -surplus), 2),
    }


def calculate_carbon_savings(energy_kwh_per_year: float) -> dict:
    """
    Calculate CO2 avoided and equivalent environmental impact.

    Based on India CEA grid emission factor 0.82 kg CO2/kWh.
    """
    co2_kg_year    = energy_kwh_per_year * CO2_KG_PER_KWH_INDIA
    co2_tonnes_year = co2_kg_year / 1000
    co2_25yr_tonnes = co2_tonnes_year * 25

    # 1 mature tree absorbs ~21 kg CO2/year
    trees_equivalent = co2_kg_year / 21.0
    # A car emits ~2.4 tonnes CO2/year (Indian average)
    cars_equivalent  = co2_tonnes_year / 2.4

    return {
        "co2_kg_per_year":      round(co2_kg_year, 1),
        "co2_tonnes_per_year":  round(co2_tonnes_year, 2),
        "co2_tonnes_25yr":      round(co2_25yr_tonnes, 1),
        "trees_equivalent_year": round(trees_equivalent, 0),
        "cars_off_road_year":   round(cars_equivalent, 1),
    }


def generate_p2p_market(surplus_kwh: float, electricity_rate: float = 8.0) -> list[dict]:
    """
    Simulate P2P energy trading marketplace — nearby buyers.
    Returns a list of simulated neighbours willing to buy surplus power.
    """
    if surplus_kwh <= 0:
        return []
    buyers = [
        {"name": "Ramesh Sharma (50m)", "demand_kwh": 3.5, "offer_rate": electricity_rate * 0.9},
        {"name": "Priya Mehta (120m)",  "demand_kwh": 5.0, "offer_rate": electricity_rate * 0.85},
        {"name": "Vikram Das (200m)",   "demand_kwh": 2.0, "offer_rate": electricity_rate * 0.92},
        {"name": "Sunita Patel (310m)", "demand_kwh": 4.5, "offer_rate": electricity_rate * 0.88},
    ]
    # Only show buyers whose demand can be (partially) met
    result = []
    remaining = surplus_kwh
    for b in buyers:
        if remaining <= 0:
            break
        fulfilled = min(b["demand_kwh"], remaining)
        result.append({
            **b,
            "fulfilled_kwh": round(fulfilled, 2),
            "earnings_inr":  round(fulfilled * b["offer_rate"], 2),
            "offer_rate":    round(b["offer_rate"], 2),
        })
        remaining -= fulfilled
    return result


def generate_blockchain_ledger(entries: int = 6) -> list[dict]:
    """
    Simulate recent blockchain transaction records for energy trades.
    Returns realistic-looking immutable ledger entries.
    """
    import hashlib, time
    records = []
    prev_hash = "0" * 64
    base_ts = int(time.time()) - entries * 3600
    transactions = [
        ("SOLAR_GEN", 12.4, "Grid Export"),
        ("P2P_SELL",   3.5, "Ramesh Sharma"),
        ("SOLAR_GEN", 11.8, "Grid Export"),
        ("P2P_SELL",   5.0, "Priya Mehta"),
        ("NET_METER",  8.9, "DISCOM Credit"),
        ("P2P_SELL",   2.0, "Vikram Das"),
    ]
    for i, (tx_type, kwh, party) in enumerate(transactions[:entries]):
        ts = base_ts + i * 3600
        data = f"{tx_type}{kwh}{party}{ts}{prev_hash}"
        block_hash = hashlib.sha256(data.encode()).hexdigest()
        records.append({
            "block":     i + 1,
            "timestamp": datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            "type":      tx_type,
            "kwh":       kwh,
            "party":     party,
            "hash":      block_hash[:16] + "…",
            "prev_hash": prev_hash[:16] + "…",
            "status":    "Confirmed",
        })
        prev_hash = block_hash
    return records
