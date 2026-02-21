"""
HelioScope AI — ROI Calculation Engine v3 (2026 Edition)
=========================================================
Now includes:
  - plant_size_kw as primary input (capacity-first)
  - Net metering credit (excess solar → grid export)
  - Tariff sensitivity analysis across tariff range
  - PM Surya Ghar CFA subsidy (MNRE 2026)
  - Degradation-aware 25-year lifetime model
"""

import math

SYSTEM_LIFETIME_YEARS   = 25
DEGRADATION_RATE        = 0.005    # 0.5% annual panel degradation
DAYS_PER_YEAR           = 365
M2_PER_KW               = 8.0     # Industry: ~8 m² per kW (crystalline Si)
COST_PER_KW_INR         = 50_000  # ₹50,000/kW installed (India 2026 MNRE benchmark)
EFFICIENCY_FACTOR       = 0.80    # System efficiency (inverter, wiring, mismatch)

# Net metering: assumed household daily consumption for excess calculation
DEFAULT_DAILY_CONSUMPTION_KWH = 10.0   # typical Indian household
NET_METERING_EXPORT_RATE      = 0.80   # 80% of tariff credited for export

# ── PM Surya Ghar CFA Subsidy — MNRE 2026 ────────────────────────────────────
PM_SURYA_GHAR_SUBSIDY = [
    (1.0,  30_000),
    (2.0,  60_000),
    (3.0,  78_000),
    (None, 78_000),
]


def calculate_pm_subsidy(system_kwp: float) -> float:
    for threshold, amount in PM_SURYA_GHAR_SUBSIDY:
        if threshold is None or system_kwp <= threshold:
            return float(amount)
    return 78_000.0


def calculate_roi(
    solar_irradiance: float,
    panel_area: float        = 100.0,
    efficiency: float        = 0.20,
    electricity_rate: float  = 8.0,
    installation_cost: float = None,
    plant_size_kw: float     = None,
    daily_consumption_kwh: float = DEFAULT_DAILY_CONSUMPTION_KWH,
) -> dict:
    """
    ROI Engine v3 — capacity-first + net metering.

    If plant_size_kw is provided (capacity-first mode):
      land_area_m2  = plant_size_kw × 8 m²/kW
      annual_energy = plant_size_kw × irradiance × 365 × 0.80

    Net metering:
      daily_generation = annual_kwh / 365
      daily_excess     = max(0, daily_generation - daily_consumption)
      net_metering_credit_per_year = daily_excess × 365 × tariff × 0.80
    """
    if plant_size_kw and plant_size_kw > 0:
        required_land_m2  = plant_size_kw * M2_PER_KW
        annual_energy_kwh = round(plant_size_kw * solar_irradiance * DAYS_PER_YEAR * EFFICIENCY_FACTOR, 1)
        system_kwp        = plant_size_kw
        if installation_cost is None or installation_cost == 0:
            inst_cost = plant_size_kw * COST_PER_KW_INR
        else:
            inst_cost = installation_cost
    else:
        required_land_m2  = panel_area
        annual_energy_kwh = round(panel_area * efficiency * solar_irradiance * DAYS_PER_YEAR, 1)
        system_kwp        = round(panel_area * efficiency / 1.0, 2)
        if installation_cost is None or installation_cost == 0:
            inst_cost = panel_area * COST_PER_KW_INR / M2_PER_KW
        else:
            inst_cost = installation_cost

    # ── Financial model ───────────────────────────────────────────────────────
    annual_savings  = round(annual_energy_kwh * electricity_rate, 2)
    monthly_savings = round(annual_savings / 12, 2)
    daily_savings   = round(annual_savings / DAYS_PER_YEAR, 2)
    payback_years   = round(inst_cost / annual_savings, 2) if annual_savings > 0 else 99.0

    # Degradation-aware lifetime yield
    lifetime_energy  = sum(annual_energy_kwh * ((1 - DEGRADATION_RATE) ** yr)
                           for yr in range(SYSTEM_LIFETIME_YEARS))
    lifetime_savings = round(lifetime_energy * electricity_rate, 2)
    lifetime_profit  = round(lifetime_savings - inst_cost, 2)

    # ── PM Surya Ghar subsidy ─────────────────────────────────────────────────
    subsidy            = calculate_pm_subsidy(system_kwp)
    net_cost           = round(inst_cost - subsidy, 2)
    net_payback        = round(net_cost / annual_savings, 2) if annual_savings > 0 else 99.0
    net_lifetime_profit = round(lifetime_savings - net_cost, 2)

    # ── Net metering ──────────────────────────────────────────────────────────
    daily_generation   = annual_energy_kwh / DAYS_PER_YEAR
    daily_excess       = max(0.0, daily_generation - daily_consumption_kwh)
    annual_export_kwh  = round(daily_excess * DAYS_PER_YEAR, 1)
    net_metering_credit = round(annual_export_kwh * electricity_rate * NET_METERING_EXPORT_RATE, 2)
    # Effective annual savings = direct savings + net metering credit
    effective_annual_savings = round(annual_savings + net_metering_credit, 2)
    net_payback_with_metering = (
        round(net_cost / effective_annual_savings, 2)
        if effective_annual_savings > 0 else 99.0
    )

    return {
        # Core energy & financial
        "energy_output_kwh_per_year":      annual_energy_kwh,
        "annual_savings_inr":              annual_savings,
        "monthly_savings_inr":             monthly_savings,
        "daily_savings_inr":               daily_savings,
        "payback_years":                   payback_years,
        "lifetime_profit_inr":             lifetime_profit,
        "system_lifetime_years":           SYSTEM_LIFETIME_YEARS,

        # System sizing
        "system_size_kwp":                 round(system_kwp, 2),
        "required_land_area_m2":           round(required_land_m2, 1),
        "installation_cost_inr":           round(inst_cost, 2),

        # PM Surya Ghar
        "subsidy_amount_inr":              subsidy,
        "net_cost_after_subsidy_inr":      net_cost,
        "payback_years_after_subsidy":     net_payback,
        "lifetime_profit_after_subsidy_inr": net_lifetime_profit,

        # Net metering v3
        "daily_generation_kwh":            round(daily_generation, 2),
        "daily_consumption_kwh":           round(daily_consumption_kwh, 2),
        "daily_excess_kwh":                round(daily_excess, 2),
        "annual_export_kwh":               annual_export_kwh,
        "net_metering_credit_inr":         net_metering_credit,
        "effective_annual_savings_inr":    effective_annual_savings,
        "payback_years_with_net_metering": net_payback_with_metering,
    }


def tariff_sensitivity(
    solar_irradiance: float,
    plant_size_kw: float,
    tariff_min: float = 4.0,
    tariff_max: float = 20.0,
    tariff_step: float = 2.0,
    daily_consumption_kwh: float = DEFAULT_DAILY_CONSUMPTION_KWH,
) -> list[dict]:
    """
    Compute ROI metrics across a range of electricity tariffs.
    Returns list of {tariff, annual_savings, payback_years, net_metering_credit}.
    """
    results = []
    tariff = tariff_min
    while tariff <= tariff_max + 0.001:
        roi = calculate_roi(
            solar_irradiance=solar_irradiance,
            plant_size_kw=plant_size_kw,
            electricity_rate=round(tariff, 2),
            daily_consumption_kwh=daily_consumption_kwh,
        )
        results.append({
            "tariff_inr_per_kwh":   round(tariff, 2),
            "annual_savings_inr":   roi["annual_savings_inr"],
            "payback_years":        roi["payback_years"],
            "payback_after_subsidy": roi["payback_years_after_subsidy"],
            "net_metering_credit":  roi["net_metering_credit_inr"],
            "effective_savings":    roi["effective_annual_savings_inr"],
        })
        tariff = round(tariff + tariff_step, 2)
    return results
