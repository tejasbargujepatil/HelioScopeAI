# HelioScope AI 🌞
**Renewable Energy Placement Intelligence Platform**

> Hybrid multi-factor renewable energy placement optimization engine using Gaussian-sigmoid scoring, economic feasibility modeling, plant capacity planning, and adaptive regional calibration.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql)](https://postgresql.org)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat&logo=python)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🚀 What is HelioScope AI?

HelioScope AI is a production-grade solar energy site selection platform that combines real-time satellite data, an 8-factor machine learning-inspired scoring engine, and AI-generated financial analysis to help individuals, developers, and enterprises find optimal rooftop and ground-mount solar locations anywhere in India (and globally).

**Key differentiators:**
- 🛰️ **Real NASA + Open-Meteo data** — not static tables
- 🧮 **8-factor Gaussian-sigmoid algorithm** — calibrated to real-world solar performance
- 🏭 **Plant-size capacity planning** — 10/20/30/50 kW or custom
- 🤖 **Gemini AI analysis** — human-readable site reports
- 📈 **Adaptive regional calibration** — learns from historical analysis data
- 💰 **PM Surya Ghar subsidy calculator** — MNRE 2026 CFA rates

---

## 🖼️ Screenshots

| Map View | Analysis Results | Energy Dashboard |
|----------|-----------------|-----------------|
| Satellite map with area drawing | 8-factor score + confidence | 7-tab Smart Energy Dashboard |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  Map (Leaflet) → AnalysisPanel → ResultsPanel → Charts  │
└────────────────────────┬────────────────────────────────┘
                         │ REST API (FastAPI)
┌────────────────────────▼────────────────────────────────┐
│                   FastAPI Backend                        │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  NASA    │  │Open-Meteo│  │Elevation │  ← Concurrent │
│  │  POWER   │  │ Weather  │  │ +Slope   │    fetch      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       └─────────────┴─────────────┘                     │
│                      ↓                                   │
│         ┌──────────────────────┐                        │
│         │  8-Factor Scoring v3 │                        │
│         │  Gaussian + Sigmoid  │                        │
│         │  + EMA Calibrator    │                        │
│         └──────────┬───────────┘                        │
│                    ↓                                     │
│         ┌──────────────────────┐                        │
│         │   ROI Engine v2      │                        │
│         │   Plant-size first   │                        │
│         │   PM Surya Ghar CFA  │                        │
│         └──────────┬───────────┘                        │
│                    ↓                                     │
│         ┌──────────────────────┐                        │
│         │   Gemini AI LLM      │                        │
│         └──────────────────────┘                        │
└─────────────────────────────────────────────────────────┘
                         │
                  PostgreSQL DB
          (analyses stored for EMA calibration)
```

---

## ⚡ Scoring Algorithm — 8 Factors

| Factor | Weight | Method | What it measures |
|--------|--------|--------|-----------------|
| ☀️ Solar Irradiance | 30% | Gaussian (optimal 5.5 kWh/m²/d) | Primary energy potential |
| 🌡️ Temperature | 10% | Gaussian (optimal 22°C) | Panel efficiency factor |
| ⛰️ Elevation | 10% | Gaussian (optimal 600m) | Atmospheric clarity |
| 💨 Wind Speed | 8% | Gaussian (optimal 3.5 m/s) | Convective cooling |
| ☁️ Cloud Cover | 10% | Sigmoid (inverted) | Yield reduction |
| 📐 Terrain Slope | 10% | Step function (<5°/5-15°/>15°) | Installation feasibility |
| ⚡ Grid Proximity | 12% | Sigmoid (0-50km) | Connection cost |
| 🏭 Plant Feasibility | 10% | Sigmoid (area ratio + irradiance) | Capacity viability |

**+ Adaptive EMA Calibration**: Regional bias correction using exponential moving average on historical analysis data (±10 points max).

---

## 🛠️ Tech Stack

### Backend
| Component | Technology |
|-----------|-----------|
| API Framework | FastAPI 0.115 |
| Scoring Engine | Pure Python (custom Gaussian-sigmoid) |
| Solar Data | NASA POWER API (ALLSKY_SFC_SW_DWN) |
| Weather Data | Open-Meteo API (wind, temp, humidity, cloud cover) |
| Elevation + Slope | Google Maps / Open-Elevation (5-point stencil) |
| AI Summary | Google Gemini 2.0 Flash |
| Database | PostgreSQL 16 + SQLAlchemy |
| Auth | JWT (HS256) + bcrypt |
| Rate Limiting | SlowAPI |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | React 19 + Vite 7 |
| Map | Leaflet.js + react-leaflet |
| Geocoding | Nominatim (OpenStreetMap) |
| Charts | Recharts |
| Styling | Vanilla CSS (dark mode, glassmorphism) |

---

## 🚦 Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL 16+

### 1. Clone & setup environment
```bash
git clone https://github.com/tejasbargujepatil/HelioScopeAI.git
cd HelioScopeAI
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start the API server
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Frontend
```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8001" > .env.local
npm run dev
```

Open **http://localhost:5173**

### 4. Docker (recommended)
```bash
docker-compose up --build
```
- Frontend: http://localhost:5173
- Backend: http://localhost:8001
- API Docs: http://localhost:8001/docs

---

## 🔑 Environment Variables

```env
# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost:5432/helioscope
JWT_SECRET=your-super-secret-key
GEMINI_API_KEY=your-gemini-api-key
GOOGLE_ELEVATION_API_KEY=your-google-key  # optional (falls back to Open-Elevation)

# Frontend (.env.local)
VITE_API_URL=http://localhost:8001
```

---

## 📡 API Reference

### `POST /api/analyze`
Main pipeline endpoint — single call returns everything.

**Request:**
```json
{
  "lat": 26.92,
  "lng": 70.90,
  "plant_size_kw": 20,
  "electricity_rate": 8.0,
  "installation_cost": 0
}
```

**Response:**
```json
{
  "score": 90,
  "grade": "A+",
  "confidence": 96.0,
  "suitability_class": "Excellent",
  "solar_irradiance": 6.5,
  "slope_degrees": 1.2,
  "cloud_cover_pct": 18.0,
  "plant_size_kw": 20,
  "required_land_area_m2": 160,
  "annual_savings_inr": 672000,
  "payback_years": 1.5,
  "subsidy_amount_inr": 78000,
  "ai_summary": "This location in Rajasthan..."
}
```

Full API docs: **http://localhost:8001/docs**

---

## 💰 Subscription Tiers

| Feature | Free | Pro | Enterprise |
|---------|------|-----|-----------|
| Analyses/month | 3 | 50 | Unlimited |
| Smart Energy Dashboard | ❌ | ✅ | ✅ |
| AI Summaries | ❌ | ✅ | ✅ |
| Export Reports | ❌ | ❌ | ✅ |

---

## 🌍 Data Sources

| Data | Source | Lag |
|------|--------|-----|
| Solar irradiance | NASA POWER API | ~2 days |
| Wind, temp, humidity, cloud | Open-Meteo | Real-time |
| Elevation + slope | Google Maps / Open-Elevation | N/A |
| Geocoding | Nominatim (OpenStreetMap) | Real-time |
| Subsidy rates | MNRE PM Surya Ghar portal | Manually updated |

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m 'feat: add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

*Built with ☀️ for India's solar future*
