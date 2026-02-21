# HelioScope AI — Investor Pitch Deck

*"Every rooftop is a power plant waiting to happen."*

---

## Slide 1 — The Problem

### India has a solar paradox.

**The opportunity:**
- 🌞 India receives **300+ sunny days/year** — among the world's highest solar irradiance
- 🏠 **300 million households** with rooftops suitable for solar
- 🏭 Government target: **500 GW renewable by 2030** (currently at ~185 GW)

**The bottleneck:**
- Homeowners don't know if their specific site is viable
- Rooftop solar adoption requires expensive on-site assessments (₹5,000–₹20,000 per site)
- 78% of potential solar customers drop out **before** getting a quote
- Solar developers waste 40% of prospecting time visiting unsuitable sites

> **The result: Gigawatts of untapped potential, sitting idle on rooftops across India.**

---

## Slide 2 — The Solution

### HelioScope AI — Instant Solar Intelligence

**What we do:**  
Any location. Any plant size. Real analysis in under 30 seconds.

*For a homeowner in Jodhpur considering a 10 kW rooftop installation:*

```
📍 Location: 26.92°N, 70.90°E
🏭 Plant Size: 10 kW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Placement Score:    90/100  Grade A+
🎯 Confidence:         96%
🌟 Suitability:        EXCELLENT

☀️ Solar:             6.5 kWh/m²/d
📐 Terrain Slope:     1.2° (Flat — ideal)
⚡ Grid Distance:     8 km
☁️ Cloud Cover:       18%

💰 Annual Savings:    ₹2,92,000
📅 Payback Period:    1.7 years (after subsidy)
🏆 25-Year Profit:    ₹63,00,000
🇮🇳 Govt Subsidy:    ₹78,000 (PM Surya Ghar)

🤖 AI Insight: "This location in Rajasthan exhibits
   world-class solar conditions..."
```

---

## Slide 3 — How It Works

### From Coordinates to Decision in 4 steps

```
      1. SELECT             2. ANALYZE           3. SCORE           4. DECIDE
   ┌──────────┐         ┌──────────────┐     ┌──────────────┐   ┌──────────────┐
   │  Click   │   →   │  Real-time   │  →  │  8-Factor   │ → │  AI Report  │
   │  on Map  │         │  Data Fetch  │     │  Algorithm  │   │  + ROI Plan │
   └──────────┘         └──────────────┘     └──────────────┘   └──────────────┘
                         NASA POWER API
                         Open-Meteo API        Gaussian-sigmoid
                         Elevation API         Confidence Score
                         (all concurrent)      EMA Calibration
```

---

## Slide 4 — The Technology Moat

### Our Algorithm is the Barrier to Entry

Most solar apps use **static irradiance tables**. We use:

| What Others Do | What HelioScope AI Does |
|---------------|------------------------|
| Fixed irradiance maps | **Real-time NASA POWER API** (12-month actual data) |
| Simple pass/fail | **8-factor Gaussian-sigmoid scoring** with confidence % |
| Ignores terrain | **5-point stencil slope estimation** from elevation API |
| Ignores cloud cover | **Real-time cloud cover** from Open-Meteo |
| No learning | **Adaptive EMA calibrator** — learns from every analysis |
| Area-first ROI | **Plant-size first** (kW → land → cost → savings) |
| No constraints | **Hard constraint filtering** (slope/solar/grid rejection) |

**Result:** Scores that actually correlate with real solar plant performance — not just "this region gets good sun."

### Algorithm Positioning
> *"Hybrid multi-factor renewable energy placement optimization engine using Gaussian-sigmoid scoring, economic feasibility modeling, plant capacity planning, and adaptive regional calibration."*

This matches enterprise-grade tools like **PVsyst**, **Helioscope Pro**, and **Aurora Solar** — but with real-time data and AI explanation, at zero-cost-per-query.

---

## Slide 5 — Market Opportunity

### India Solar Market — The Numbers

| Metric | Value |
|--------|-------|
| India rooftop solar addressable market | **$25 billion** (2025–2030) |
| PM Surya Ghar target | 10 million households |
| Solar developers in India | 8,000+ registered |
| Site assessment cost (traditional) | ₹5,000–₹20,000 per site |
| HelioScope AI cost per analysis | **₹0 marginal cost** |
| Global solar site intelligence market | **$2.1 billion** (2024) |

### What We Eliminate
- ❌ ₹15,000 average initial site survey cost
- ❌ 2–3 week wait for assessment report
- ❌ 40% of unsuitable sites that waste developer time

---

## Slide 6 — Business Model

### Three Revenue Streams

#### 1. SaaS Subscriptions (Primary)
| Tier | Price | Target | Revenue/user/yr |
|------|-------|--------|----------------|
| Free | ₹0 | Individual homeowners | ₹0 |
| Pro | ₹499/mo | Serious buyers, small installers | ₹5,988 |
| Enterprise | ₹1,999/mo | Solar developers, EPCs | ₹23,988 |

#### 2. API Access (Developer Tier)
- Pay-per-analysis pricing: ₹49/analysis
- White-label integration for solar companies
- Bulk pricing for >1,000 analyses/month

#### 3. Data Insights (Future)
- Regional solar potential reports for investors
- Municipal-scale analysis for state governments
- Portfolio screening for solar funds

### Unit Economics (Year 2 projection)
```
Pro users:        1,000  × ₹499/mo  = ₹49.9L/mo
Enterprise users:   100  × ₹1,999/mo = ₹20.0L/mo
API calls:      50,000  × ₹49       = ₹24.5L/mo
                                Total = ₹94.4L/mo (~₹11.3 Cr/yr)
```

---

## Slide 7 — Traction & Validation

### What We've Built

✅ **Fully functional platform** — not a mockup  
✅ **Production-grade algorithm v3** — 8-factor Gaussian-sigmoid  
✅ **Live API integrations** — NASA, Open-Meteo, Gemini AI  
✅ **Adaptive learning system** — EMA calibrator from DB history  
✅ **Complete auth/billing infra** — JWT, subscription tiers  
✅ **Docker + Kubernetes deployment** — production-ready  

### Benchmark Validation

| Location tested | Algorithm Score | Ground Truth (Expected) | Match |
|----------------|----------------|------------------------|-------|
| Rajasthan (Jodhpur) | 90/100 A+ | Top Indian solar zone | ✅ |
| Bengaluru | 95/100 A+ | High irradiance plateau | ✅ |
| London UK | 61/100 B | Moderate solar, EU norm | ✅ |
| Norway (Arctic) | 34/100 F | Low sun, rejected | ✅ |
| Mumbai coastal | 87/100 A | Good but high humidity | ✅ |

---

## Slide 8 — Team

### Why We'll Win

| Role | Expertise |
|------|-----------|
| **Engineering** | FastAPI, React, ML-inspired scoring algorithms |
| **Solar Domain** | MNRE policy, PM Surya Ghar subsidy mechanics, DISCOM rates |
| **Data Science** | NASA POWER data analysis, Gaussian process modeling |
| **Growth** | B2B SaaS sales, solar developer network |

---

## Slide 9 — Go-To-Market

### Phase 1 — Developer Validation (Months 1–3)
- Target: 50 solar installers in Rajasthan, Gujarat, Maharashtra
- Offer: Free Enterprise tier for 90 days in exchange for feedback
- Goal: 500 analyses/week, case studies

### Phase 2 — Consumer Launch (Months 4–6)
- PM Surya Ghar tie-in: "Check if your home qualifies" viral loop
- Content: "Is my rooftop good for solar?" SEO campaign
- Target: 10,000 free users, 500 Pro conversions

### Phase 3 — B2B Scale (Months 7–12)
- Pitch to top 20 solar EPCs in India (Waaree, Adani Solar, etc.)
- API integration partnerships with rooftop solar marketplaces
- Government pilot: Smart Cities rooftop solar mapping

---

## Slide 10 — The Ask

### Seed Raise: ₹1.5 Crore ($180K)

| Use of Funds | Amount | Purpose |
|-------------|--------|---------|
| Engineering (2 hires) | ₹60L | ML enhancements, mobile app |
| Cloud infrastructure | ₹25L | AWS/GCP, CDN, PostgreSQL scale |
| Sales & Marketing | ₹40L | Developer outreach, content, events |
| Operations & Legal | ₹15L | Entity, compliance |
| Reserve | ₹10L | Buffer |

### 18-Month Milestones

```
Month 6:   1,000 Pro users  │  ₹50L ARR
Month 12:  5,000 Pro users  │  ₹3 Cr ARR
Month 18:  15,000 users     │  ₹10 Cr ARR + Series A ready
```

---

## Slide 11 — Vision

### Beyond Rooftops

**Year 1:** India rooftop solar — homeowners, developers  
**Year 2:** Industrial + utility-scale site selection  
**Year 3:** Multi-country expansion (Southeast Asia, Middle East, Africa)  
**Year 5:** The Bloomberg Terminal for renewable energy siting

> *"Just like Google Maps changed how we navigate, HelioScope AI will change how the world finds its solar potential."*

**Every 1°C of warming is a call to action. We're building the intelligence layer to accelerate the solar transition.**

---

## Appendix A — Competitor Analysis

| Product | Solar Data | Algorithm | AI | Pricing | Our Edge |
|---------|-----------|-----------|-----|---------|---------|
| Google Project Sunroof | ✅ | Simple | ❌ | Free | 8-factor + confidence + plant-size |
| Aurora Solar | ✅ | Advanced | Partial | $$$$ | Fraction of cost, API-first |
| PVsyst | ✅ | Expert | ❌ | $$$ | Consumer-friendly, real-time |
| Helioscope Pro | ✅ | Advanced | ❌ | $$$$ | India-first, subsidies, AI |
| **HelioScope AI** | **NASA live** | **8-factor v3** | **Gemini** | **Freemium** | **✅ All of the above** |

---

## Appendix B — Technical Architecture Summary

```
Frontend: React 19 + Vite + Leaflet.js
Backend:  FastAPI (Python 3.12) + PostgreSQL 16
Engine:   8-factor Gaussian-sigmoid + EMA adaptive calibration
Data:     NASA POWER + Open-Meteo + Elevation API (concurrent fetch)
AI:       Google Gemini 2.0 Flash
Auth:     JWT HS256 + bcrypt
Deploy:   Docker + Kubernetes
```

---

*Contact: [tejasbarguje9@gmail.com]*  
*GitHub: https://github.com/tejasbargujepatil/HelioScopeAI*  
*Demo: http://helioscopeai.xyz*

---
*© 2026 HelioScope AI — Confidential*
