"""
HelioScope AI — Gemini AI Integration
Generates intelligent placement recommendations using Google Gemini.
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def generate_summary(
    score: int,
    roi_years: float,
    lat: float,
    lng: float,
    solar_irradiance: Optional[float] = None,
    wind_speed: Optional[float] = None,
    elevation: Optional[float] = None,
    annual_savings: Optional[float] = None,
) -> dict:
    """
    Generate an AI-powered recommendation using Google Gemini.
    Falls back to a template-based response if the API key is not set.
    """
    api_key = os.getenv("GEMINI_API_KEY", "")

    if not api_key:
        logger.info("GEMINI_API_KEY not set — using template-based summary.")
        return {
            "summary": _template_summary(score, roi_years, solar_irradiance, wind_speed, elevation, annual_savings),
            "generated_by": "template",
        }

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)

        # Try models in order of preference (newest first)
        model_names = [
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-1.5-flash-latest",
            "gemini-1.5-flash",
            "gemini-pro",
        ]

        prompt = _build_prompt(score, roi_years, lat, lng, solar_irradiance, wind_speed, elevation, annual_savings)
        last_err = None

        for model_name in model_names:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                logger.info(f"Gemini response via {model_name}")
                return {
                    "summary": response.text.strip(),
                    "generated_by": model_name,
                }
            except Exception as e:
                last_err = e
                logger.warning(f"Gemini model {model_name} failed: {e}")
                continue

        raise last_err

    except Exception as e:
        logger.error(f"All Gemini models failed: {e}")
        return {
            "summary": _template_summary(score, roi_years, solar_irradiance, wind_speed, elevation, annual_savings),
            "generated_by": "template",
        }


def _build_prompt(
    score: int,
    roi_years: float,
    lat: float,
    lng: float,
    solar_irradiance: Optional[float],
    wind_speed: Optional[float],
    elevation: Optional[float],
    annual_savings: Optional[float],
) -> str:
    details = []
    if solar_irradiance:
        details.append(f"Solar Irradiance: {solar_irradiance} kWh/m²/day")
    if wind_speed:
        details.append(f"Wind Speed: {wind_speed} m/s")
    if elevation:
        details.append(f"Elevation: {elevation} m")
    if annual_savings:
        details.append(f"Estimated Annual Savings: ₹{annual_savings:,.0f}")

    details_str = "\n".join(details) if details else "N/A"

    return f"""You are HelioScope AI, an expert in renewable energy site evaluation.

Analyze this location and provide a concise (3-4 sentence), professional, and actionable recommendation for renewable energy installation.

Location: {lat:.4f}°N, {lng:.4f}°E
Placement Score: {score}/100
ROI Payback Period: {roi_years} years
{details_str}

Address:
1. Whether this site is suitable for solar, wind, or both.
2. The key factor driving the score (solar, wind, or elevation).
3. Practical advice for maximizing energy yield.
4. Investment outlook.

Keep it concise, insightful, and data-driven."""


def _template_summary(
    score: int,
    roi_years: float,
    solar_irradiance: Optional[float],
    wind_speed: Optional[float],
    elevation: Optional[float],
    annual_savings: Optional[float],
) -> str:
    """Generate a smart template-based summary when Gemini is unavailable."""
    if score >= 80:
        suitability = "an excellent"
        outlook = "The investment outlook is very strong"
    elif score >= 65:
        suitability = "a good"
        outlook = "The investment outlook is favorable"
    elif score >= 50:
        suitability = "a moderate"
        outlook = "The investment outlook is acceptable"
    else:
        suitability = "a below-average"
        outlook = "Consider alternative sites for better returns"

    solar_note = f"with solar irradiance of {solar_irradiance:.1f} kWh/m²/day" if solar_irradiance else ""
    wind_note = f" and wind speed of {wind_speed:.1f} m/s" if wind_speed else ""
    savings_note = f" Estimated annual savings of ₹{annual_savings:,.0f} make this" if annual_savings else " This"

    return (
        f"This location has {suitability} renewable energy potential (score: {score}/100) "
        f"{solar_note}{wind_note}. "
        f"{savings_note} site financially viable with a payback period of approximately {roi_years:.1f} years. "
        f"{outlook}, and installation of solar panels is recommended for optimal energy yield."
    )
