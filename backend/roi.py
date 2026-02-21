"""
HelioScope AI — ROI Calculation Engine v2 (2026 Edition)
=========================================================
Now supports plant_size_kw as primary input for capacity-first planning.
Derives land area, energy output, and installation cost from plant size.
Includes PM Surya Ghar Subsidy (CFA) + degradation-aware lifetime model.
"""

SYSTEM_LIFETIME_YEARS   = 25
DEGRADATION_RATE        = 0.005    # 0.5% annual panel degradation
DAYS_PER_YEAR           = 365
M2_PER_KW               = 8.0     # Industry: ~8 m² per kW (crystalline Si)
COST_PER_KW_INR         = 50_000  # ₹50,000/kW installed (India 2026 MNRE benchmark)
EFFICIENCY_FACTOR       = 0.80    # System efficiency (inverter, wiring, mismatch)

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
    panel_area: float       = 100.0,
    efficiency: float       = 0.20,
    electricity_rate: float = 8.0,
    installation_cost: float = None,     # ← auto if None (derived from plant_size_kw)
    plant_size_kw: float    = None,      # ← NEW primary input
) -> dict:
    """
    ROI Engine v2 — capacity-first or area-first planning.

    If plant_size_kw is provided:
      • land_area_m2  = plant_size_kw × 8  m²/kW
      • annual_energy = plant_size_kw × solar_irradiance × 365 × efficiency_factor
      • installation_cost = plant_size_kw × cost_per_kw  (if not overridden)

    Otherwise falls back to legacy panel_area × efficiency calculation.
    """
    if plant_size_kw and plant_size_kw > 0:
        # ── Capacity-first mode ───────────────────────────────────────────
        required_land_m2   = plant_size_kw * M2_PER_KW
        # kW → kWh/yr:  kW × irradiance(kWh/m²/d) × 365d × system_efficiency
        annual_energy_kwh  = round(plant_size_kw * solar_irradiance * DAYS_PER_YEAR * EFFICIENCY_FACTOR, 1)
        system_kwp         = plant_size_kw

        # Installation cost: user override or MNRE benchmark
        if installation_cost is None or installation_cost == 0:
            inst_cost = plant_size_kw * COST_PER_KW_INR
        else:
            inst_cost = installation_cost

    else:
        # ── Legacy area-first mode ────────────────────────────────────────
        required_land_m2  = panel_area
        annual_energy_kwh = round(panel_area * efficiency * solar_irradiance * DAYS_PER_YEAR, 1)
        system_kwp        = round(panel_area * efficiency / 1.0, 2)   # approx kWp

        if installation_cost is None or installation_cost == 0:
            inst_cost = panel_area * COST_PER_KW_INR / M2_PER_KW
        else:
            inst_cost = installation_cost

    # ── Financial model ───────────────────────────────────────────────────
    annual_savings    = round(annual_energy_kwh * electricity_rate, 2)
    monthly_savings   = round(annual_savings / 12, 2)
    daily_savings     = round(annual_savings / DAYS_PER_YEAR, 2)

    payback_years     = round(inst_cost / annual_savings, 2) if annual_savings > 0 else 99.0

    # Degradation-aware lifetime yield
    lifetime_energy   = sum(
        annual_energy_kwh * ((1 - DEGRADATION_RATE) ** yr)
        for yr in range(SYSTEM_LIFETIME_YEARS)
    )
    lifetime_savings  = round(lifetime_energy * electricity_rate, 2)
    lifetime_profit   = round(lifetime_savings - inst_cost, 2)

    # ── PM Surya Ghar subsidy ─────────────────────────────────────────────
    subsidy           = calculate_pm_subsidy(system_kwp)
    net_cost          = round(inst_cost - subsidy, 2)
    net_payback       = round(net_cost / annual_savings, 2) if annual_savings > 0 else 99.0
    net_lifetime_profit = round(lifetime_savings - net_cost, 2)

    # ── Net Metering calculation ──────────────────────────────────────────
    # Typical rooftop self-consumption: 70%, export 30% at 50% of retail rate
    self_consumption_pct = 0.70
    export_rate_pct      = 0.50   # % of retail tariff paid for exports

    self_consumed_kwh    = round(annual_energy_kwh * self_consumption_pct, 1)
    exported_kwh         = round(annual_energy_kwh * (1 - self_consumption_pct), 1)
    self_saved_inr       = round(self_consumed_kwh * electricity_rate, 2)
    export_credit_inr    = round(exported_kwh * electricity_rate * export_rate_pct, 2)
    net_metering_annual  = round(self_saved_inr + export_credit_inr, 2)
    net_metering_payback = round(inst_cost / net_metering_annual, 2) if net_metering_annual > 0 else 99.0

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

        # Net Metering
        "self_consumed_kwh":               self_consumed_kwh,
        "exported_kwh":                    exported_kwh,
        "self_saving_inr":                 self_saved_inr,
        "export_credit_inr":               export_credit_inr,
        "net_metering_annual_benefit_inr": net_metering_annual,
        "net_metering_payback_years":      net_metering_payback,
        "electricity_rate":                electricity_rate,
    }


# ── Tariff sensitivity table ─────────────────────────────────────────────────

def calculate_tariff_sensitivity(
    solar_irradiance: float,
    plant_size_kw: float,
    installation_cost: float,
    tariff_rates: list = None,
) -> list:
    """
    Return a list of {tariff, annual_savings, payback_years} dicts
    at various electricity tariff rates for sensitivity chart.
    """
    if tariff_rates is None:
        tariff_rates = [4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 12.0, 15.0]

    annual_energy = plant_size_kw * solar_irradiance * DAYS_PER_YEAR * EFFICIENCY_FACTOR
    results = []
    for rate in tariff_rates:
        savings  = round(annual_energy * rate, 0)
        payback  = round(installation_cost / savings, 2) if savings > 0 else 99.0
        results.append({
            "tariff_rate":       rate,
            "annual_savings_inr": savings,
            "payback_years":     payback,
        })
    return results
