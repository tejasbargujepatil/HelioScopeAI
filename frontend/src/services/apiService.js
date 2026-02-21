import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 60000,  // 60s — full pipeline (NASA + LLM) can take time
    headers: { 'Content-Type': 'application/json' },
});

/**
 * UNIFIED PIPELINE — single call following the system execution flow:
 * React → FastAPI → NASA + Open-Meteo → Algorithm → ROI Engine → LLM → React
 *
 * Returns everything: placement score, ROI, and AI summary in one response.
 */
export const analyzeFullPipeline = async ({
    lat,
    lng,
    panelArea = 100,
    efficiency = 0.20,
    electricityRate = 8.0,
    installationCost = 0,
    plant_size_kw = 10,
    available_area_m2 = null,
    token = null,
}) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const body = {
        lat, lng,
        panel_area: panelArea,
        efficiency,
        electricity_rate: electricityRate,
        installation_cost: installationCost,
        plant_size_kw,
    };
    if (available_area_m2 != null) body.available_area_m2 = available_area_m2;
    const { data } = await api.post('/api/analyze', body, { headers });
    return data;
};


// ── Legacy individual endpoints (kept for direct API access) ─────────────────

export const analyzeLocation = async ({ lat, lng, panelArea = 100, efficiency = 0.18 }) => {
    const { data } = await api.post('/api/analyze-placement', {
        lat, lng, panel_area: panelArea, efficiency,
    });
    return data;
};

export const calculateROI = async ({
    solarIrradiance, panelArea = 100, efficiency = 0.18,
    electricityRate = 8.0, installationCost = 500000,
}) => {
    const { data } = await api.post('/api/calculate-roi', {
        solar_irradiance: solarIrradiance, panel_area: panelArea, efficiency,
        electricity_rate: electricityRate, installation_cost: installationCost,
    });
    return data;
};

export const generateSummary = async ({
    score, roiYears, lat, lng, solarIrradiance, windSpeed, elevation, annualSavings,
}) => {
    const { data } = await api.post('/api/generate-summary', {
        score, roi_years: roiYears, lat, lng,
        solar_irradiance: solarIrradiance, wind_speed: windSpeed,
        elevation, annual_savings: annualSavings,
    });
    return data;
};

export const healthCheck = async () => {
    const { data } = await api.get('/api/health');
    return data;
};

export default api;
