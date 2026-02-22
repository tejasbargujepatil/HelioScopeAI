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
## 🏗️ Architecture of System

```mermaid
flowchart TB

%% =========================
%% USER LAYER
%% =========================

User[User]

%% =========================
%% FRONTEND LAYER
%% =========================

subgraph Frontend["Frontend Layer (React + Leaflet + Mapbox)"]

MapComponent[Map Component\nPolygon Selection]
AnalysisPanel[Analysis Panel\nPlant Capacity + Config]
ResultsPanel[Results Panel\nScore + Heatmap]
ROIComponent[ROI Dashboard]
SummaryComponent[AI Summary Panel]

APIService[API Service Layer]

MapComponent --> APIService
AnalysisPanel --> APIService
ResultsPanel --> APIService
ROIComponent --> APIService
SummaryComponent --> APIService

end

User --> MapComponent

%% =========================
%% API GATEWAY LAYER
%% =========================

subgraph APIGateway["API Gateway Layer"]

FastAPI[FastAPI Gateway\nAuth + Routing + Validation]

end

APIService --> FastAPI

%% =========================
%% BACKEND MICROSERVICES
%% =========================

subgraph Backend["Backend Microservices Layer"]

PlacementController[Placement Controller]
ROIController[ROI Controller]
SummaryController[Summary Controller]
AuthController[Auth Controller]

FastAPI --> PlacementController
FastAPI --> ROIController
FastAPI --> SummaryController
FastAPI --> AuthController

end

%% =========================
%% CORE ALGORITHM ENGINE
%% =========================

subgraph AlgorithmEngine["Hybrid Renewable Placement Optimization Engine (HRPOE)"]

GridEngine[Grid Division Engine\nPolygon → Grid Cells]

SolarService[Solar Irradiance Service]
WindService[Wind Speed Service]
ElevationService[Elevation Service]
WeatherService[Temperature + Cloud Service]
GridProximityService[Grid Infrastructure Service]

GaussianNormalizer[Gaussian Normalization Engine]
SigmoidNormalizer[Sigmoid Normalization Engine]

WeightedScoring[Weighted Multi-Factor Scoring Engine]

FeasibilityEngine[Plant Capacity Feasibility Engine]

ROIEngine[ROI Calculation Engine]

ConfidenceEngine[Confidence Score Engine]

HeatmapEngine[Heatmap Generator]

BestLocationEngine[Optimal Placement Selector]

end

PlacementController --> GridEngine

GridEngine --> SolarService
GridEngine --> WindService
GridEngine --> ElevationService
GridEngine --> WeatherService
GridEngine --> GridProximityService

SolarService --> GaussianNormalizer
WindService --> GaussianNormalizer
ElevationService --> GaussianNormalizer

WeatherService --> SigmoidNormalizer
GridProximityService --> SigmoidNormalizer

GaussianNormalizer --> WeightedScoring
SigmoidNormalizer --> WeightedScoring

WeightedScoring --> FeasibilityEngine

FeasibilityEngine --> ROIEngine

ROIEngine --> ConfidenceEngine

ConfidenceEngine --> HeatmapEngine

HeatmapEngine --> BestLocationEngine

BestLocationEngine --> PlacementController

ROIController --> ROIEngine

%% =========================
%% LLM SERVICE
%% =========================

subgraph LLMService["AI Explanation Service"]

LLMEngine[LLM Service\nGemini / OpenAI]

end

SummaryController --> LLMEngine

%% =========================
%% DATABASE
%% =========================

subgraph Database["Database Layer"]

PostgreSQL[(PostgreSQL\nUser Data\nAnalysis Data\nCache)]

end

PlacementController --> PostgreSQL
ROIController --> PostgreSQL
SummaryController --> PostgreSQL
AuthController --> PostgreSQL

%% =========================
%% EXTERNAL APIs
%% =========================

subgraph ExternalAPIs["External Data Providers"]

NASA[NASA POWER API\nSolar Irradiance]
OpenMeteo[Open-Meteo API\nWeather Data]
ElevationAPI[Open Elevation API]
OSM[OpenStreetMap API\nGrid Infrastructure]

end

SolarService --> NASA
WindService --> OpenMeteo
WeatherService --> OpenMeteo
ElevationService --> ElevationAPI
GridProximityService --> OSM

%% =========================
%% CONTAINERIZATION
%% =========================

subgraph DockerLayer["Docker Container Layer"]

FrontendContainer[React Container]
BackendContainer[FastAPI Container]
AlgorithmContainer[Algorithm Engine Container]
DBContainer[PostgreSQL Container]

end

FrontendContainer --> BackendContainer
BackendContainer --> AlgorithmContainer
BackendContainer --> DBContainer

%% =========================
%% KUBERNETES ORCHESTRATION
%% =========================

subgraph Kubernetes["Kubernetes Cluster"]

Ingress[Ingress Controller]

FrontendPod[Frontend Pod]
BackendPod[Backend Pod]
AlgorithmPod[Algorithm Pod]
DBPod[Database Pod]

ServiceMesh[Service Networking]

end

Ingress --> FrontendPod
FrontendPod --> BackendPod
BackendPod --> AlgorithmPod
BackendPod --> DBPod

%% =========================
%% SECURITY LAYER
%% =========================

subgraph Security["Security Layer"]

JWT[JWT Authentication]
RateLimit[Rate Limiting]
APISecurity[API Validation]
Secrets[Secrets Management]

end

AuthController --> JWT
FastAPI --> RateLimit
FastAPI --> APISecurity
BackendPod --> Secrets

%% =========================
%% FINAL OUTPUT FLOW
%% =========================

PlacementController --> ResultsPanel
ROIController --> ROIComponent
SummaryController --> SummaryComponent

ResultsPanel --> User
ROIComponent --> User
SummaryComponent --> User
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
