import { useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import MapComponent from './components/MapComponent';
import AnalysisPanel from './components/AnalysisPanel';
import ResultsPanel from './components/ResultsPanel';
import ROIComponent from './components/ROIComponent';
import SummaryComponent from './components/SummaryComponent';
import EnergyDashboard from './components/EnergyDashboard';
import SeasonalChart from './components/SeasonalChart';
import AuthModal from './components/AuthModal';
import BillingModal from './components/BillingModal';
import DemoTierSwitcher from './components/DemoTierSwitcher';
import LandingPage from './components/LandingPage';
import { analyzeFullPipeline } from './services/apiService';
import './index.css';

// ── Inner app (inside AuthProvider so useAuth() works) ───────────────────────
function AppInner() {
  const { user, token, logout, refreshUser } = useAuth();
  const [showLanding, setShowLanding] = useState(true);

  const [selectedCoords, setSelectedCoords] = useState(null);
  const [pipelineResult, setPipelineResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState(null);
  const [drawnArea, setDrawnArea] = useState(null);
  const [drawnVertices, setDrawnVertices] = useState(null);  // polygon [[lat,lng]...]
  const [heatmapData, setHeatmapData] = useState(null);
  const [nationwideData, setNationwideData] = useState(null);
  const [nationwideLoading, setNationwideLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [dashboardExpanded, setDashboardExpanded] = useState(false);

  const handleLocationSelect = useCallback(({ lat, lng }) => {
    setSelectedCoords({ lat, lng });
    setPipelineResult(null);
    setError(null);
    setDashboardExpanded(false);
  }, []);

  const handleAreaDrawn = useCallback(({ area, vertices, centroid }) => {
    setDrawnArea(area);
    setDrawnVertices(vertices || null);
    if (centroid) setSelectedCoords(centroid);
  }, []);

  // ── Nationwide heatmap fetch ─────────────────────────────────────────────
  const fetchNationwideHeatmap = useCallback(async (plantKw = 10) => {
    if (nationwideData) { setNationwideData(null); return; } // toggle off
    setNationwideLoading(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(`${API_BASE}/api/heatmap/nationwide?plant_size_kw=${plantKw}`, { headers });
      const d = await r.json();
      if (d.cells) {
        setNationwideData(d);
        setHeatmapData(null); // clear polygon heatmap when showing national
      }
    } catch (e) { console.warn('Nationwide heatmap error:', e); }
    finally { setNationwideLoading(false); }
  }, [nationwideData, token]);

  const handleAnalyze = useCallback(async ({ panelArea, efficiency, electricityRate, installationCost, plantSizeKw }) => {
    if (!selectedCoords) return;
    if (!user) { setShowAuth(true); return; }
    if (user.tier === 'free' && user.analyses_used >= 3) { setShowBilling(true); return; }

    setIsLoading(true); setPipelineResult(null); setError(null);
    setLoadingStage('🛰️  Fetching solar & wind + slope data (NASA + Open-Meteo)...');

    const stages = [
      [5000, '⚡  8-factor algorithm calculating placement score...'],
      [10000, '💰  ROI Engine computing capacity-first returns...'],
      [14000, '🤖  Gemini AI generating explanation...'],
    ];
    const timers = stages.map(([d, l]) => setTimeout(() => setLoadingStage(l), d));

    // drawnArea  → available_area_m2 (physical rooftop space, not panel count)
    // plantSizeKw → drives all ROI calculations  (always use MNRE benchmark cost)
    // installationCost from UI is panel-area-based — IGNORE when plant_size_kw is set
    const availableArea = drawnArea || null;
    // When capacity-first (plantSizeKw > 0), let backend auto-compute cost
    // from plant_size_kw × ₹50,000/kW (MNRE 2026 benchmark).
    // User's costPerM2 * drawnArea is wildly wrong for large polygons.
    const safeInstallCost = (plantSizeKw && plantSizeKw > 0) ? 0 : (installationCost || 0);

    try {
      const result = await analyzeFullPipeline({
        lat: selectedCoords.lat, lng: selectedCoords.lng,
        panelArea, efficiency, electricityRate,
        installationCost: safeInstallCost,
        plant_size_kw: plantSizeKw || 10,
        available_area_m2: availableArea,
        token,
      });
      timers.forEach(clearTimeout);
      setLoadingStage(''); setIsLoading(false);
      setPipelineResult({
        ...result,
        panel_area: panelArea,
        efficiency,
        electricity_rate: electricityRate,
      });
      setDashboardExpanded(true);  // ← auto-expand on results

      // ── Auto-trigger heatmap if polygon was drawn ──────────────────────
      if (drawnVertices && drawnVertices.length >= 3 && result) {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        fetch(`${API_BASE}/api/heatmap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({
            vertices: drawnVertices,
            plant_size_kw: plantSizeKw || 10,
            solar_irradiance: result.solar_irradiance || 5.5,
            wind_speed: result.wind_speed || 3.5,
            temperature: result.temperature_c || 25,
            humidity: result.humidity_pct || 50,
            cloud_cover_pct: result.cloud_cover_pct || 30,
            grid_distance_km: null,
            available_area_m2: drawnArea || null,
            cell_metres: 100,
          }),
        })
          .then(r => r.json())
          .then(d => { if (d.cells) setHeatmapData(d); })
          .catch(() => { });  // non-blocking — heatmap is bonus feature
      }
    } catch (err) {
      timers.forEach(clearTimeout);
      const detail = err.response?.data?.error || err.message || 'Analysis failed.';
      // Handle upgrade_required errors from backend
      if (detail.startsWith('upgrade_required') || detail.startsWith('quota_exceeded')) {
        setShowBilling(true);
      } else if (err.response?.status === 401) {
        setShowAuth(true);
      } else {
        setError(detail);
      }
      setLoadingStage(''); setIsLoading(false);
    }
  }, [selectedCoords, user, token, drawnArea]);

  const placementData = pipelineResult ? {
    // Core score
    score: pipelineResult.score,
    grade: pipelineResult.grade,
    confidence: pipelineResult.confidence,
    suitability_class: pipelineResult.suitability_class,
    recommendation: pipelineResult.recommendation,
    constraint_violations: pipelineResult.constraint_violations || [],
    is_suitable: pipelineResult.is_suitable,
    // Climate
    solar_irradiance: pipelineResult.solar_irradiance,
    wind_speed: pipelineResult.wind_speed,
    elevation: pipelineResult.elevation,
    temperature_c: pipelineResult.temperature_c,
    humidity_pct: pipelineResult.humidity_pct,
    cloud_cover_pct: pipelineResult.cloud_cover_pct,
    slope_degrees: pipelineResult.slope_degrees,
    // Sub-scores (8 factors)
    solar_score: pipelineResult.solar_score,
    wind_score: pipelineResult.wind_score,
    elevation_score: pipelineResult.elevation_score,
    temperature_score: pipelineResult.temperature_score,
    cloud_score: pipelineResult.cloud_score,
    slope_score: pipelineResult.slope_score,
    grid_score: pipelineResult.grid_score,
    plant_size_score: pipelineResult.plant_size_score,
    calibration_adjustment: pipelineResult.calibration_adjustment,
    algorithm_version: pipelineResult.algorithm_version,
    lat: pipelineResult.lat,
    lng: pipelineResult.lng,
  } : null;

  const roiData = pipelineResult ? {
    energy_output_kwh_per_year: pipelineResult.energy_output_kwh_per_year,
    annual_savings_inr: pipelineResult.annual_savings_inr,
    payback_years: pipelineResult.payback_years,
    lifetime_profit_inr: pipelineResult.lifetime_profit_inr,
    monthly_savings_inr: pipelineResult.monthly_savings_inr,
    daily_savings_inr: pipelineResult.daily_savings_inr,
    system_lifetime_years: pipelineResult.system_lifetime_years,
    system_size_kwp: pipelineResult.system_size_kwp,
    subsidy_amount_inr: pipelineResult.subsidy_amount_inr,
    net_cost_after_subsidy_inr: pipelineResult.net_cost_after_subsidy_inr,
    payback_years_after_subsidy: pipelineResult.payback_years_after_subsidy,
    lifetime_profit_after_subsidy_inr: pipelineResult.lifetime_profit_after_subsidy_inr,
    // Net metering
    self_consumed_kwh: pipelineResult.self_consumed_kwh,
    exported_kwh: pipelineResult.exported_kwh,
    self_saving_inr: pipelineResult.self_saving_inr,
    export_credit_inr: pipelineResult.export_credit_inr,
    net_metering_annual_benefit_inr: pipelineResult.net_metering_annual_benefit_inr,
    net_metering_payback_years: pipelineResult.net_metering_payback_years,
    electricity_rate: pipelineResult.electricity_rate,
  } : null;

  const summaryData = pipelineResult ? {
    summary: pipelineResult.ai_summary, generated_by: pipelineResult.ai_generated_by,
  } : null;

  const tierBadge = (tier) => ({
    free: { color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: 'Free' },
    pro: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: '⚡ Pro' },
    enterprise: { color: '#6366f1', bg: 'rgba(99,102,241,0.1)', label: '🚀 Enterprise' },
  }[tier] || { color: '#64748b', bg: '#1e293b', label: 'Free' });

  const badge = user ? tierBadge(user.tier) : null;

  // Show 3D landing page on first load
  if (showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} />;
  }

  return (
    <div className="app-layout">
      {/* Modals */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showBilling && <BillingModal onClose={() => setShowBilling(false)}
        onUpgraded={() => { setShowBilling(false); }} />}

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="brand-icon">⚡</div>
          <div className="brand-text">
            <h1>HelioScope AI</h1>
            <span>Renewable Energy Placement Intelligence</span>
          </div>
        </div>

        {/* Auth area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          {user ? (
            <>
              <span style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700,
                background: badge.bg, color: badge.color,
              }}>{badge.label}</span>
              {user.tier === 'free' && (
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  {user.analyses_used ?? 0}/3 analyses
                </span>
              )}
              <button onClick={() => setShowBilling(true)} style={{
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 7, color: '#f59e0b', fontSize: 12, fontWeight: 700, padding: '5px 12px', cursor: 'pointer',
              }}>Upgrade</button>
              <DemoTierSwitcher />
              <button onClick={logout} style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 7, color: '#64748b', fontSize: 12, padding: '5px 12px', cursor: 'pointer',
              }}>Sign Out</button>
            </>
          ) : (
            <button onClick={() => setShowAuth(true)} style={{
              background: 'linear-gradient(90deg,#f59e0b,#d97706)', border: 'none',
              borderRadius: 7, color: '#fff', fontWeight: 700, fontSize: 13, padding: '7px 18px', cursor: 'pointer',
            }}>Sign In / Register</button>
          )}

          <div className="navbar-status">
            <div className="status-dot" />
            {isLoading ? loadingStage || 'Analyzing...' : pipelineResult ? '✓ Analysis Ready' : 'System Online'}
          </div>
        </div>
      </nav>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <div className={`main-content${dashboardExpanded ? ' results-expanded' : ''}`}>
        {/* Left — Map (with collapse toggle button) */}
        <div style={{ position: 'relative' }}>
          <MapComponent
            onLocationSelect={handleLocationSelect}
            onAreaDrawn={handleAreaDrawn}
            selectedCoords={selectedCoords}
            score={placementData?.score}
            drawnArea={drawnArea}
            heatmapData={heatmapData}
            nationwideHeatmapData={nationwideData}
            onNationwideToggle={fetchNationwideHeatmap}
            nationwideLoading={nationwideLoading}
          />
          {/* Expand/Collapse toggle */}
          {pipelineResult && (
            <button
              className="map-collapse-btn"
              onClick={() => setDashboardExpanded(e => !e)}
              title={dashboardExpanded ? 'Expand map' : 'Collapse map'}
            >
              {dashboardExpanded ? '▶ Map' : '◀ Results'}
            </button>
          )}
        </div>

        {/* Right — Sidebar wrapper (flex-column so close bar stays fixed above scroll) */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-color)',
          height: '100%', overflow: 'hidden',
        }}>

          {/* ── Close bar: always on top, never scrolls away ── */}
          {dashboardExpanded && pipelineResult && (
            <div style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 18px',
              background: 'rgba(10,22,40,0.98)',
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              zIndex: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>📊</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
                  Analysis Results
                </span>
                {placementData?.grade && (
                  <span style={{
                    fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 12,
                    background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                    border: '1px solid rgba(245,158,11,0.3)',
                  }}>
                    Grade {placementData.grade}
                  </span>
                )}
                {placementData?.score && (
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    Score {placementData.score}/100
                  </span>
                )}
              </div>
              <button
                onClick={() => setDashboardExpanded(false)}
                title="Close results — return to map"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 8, color: '#f87171',
                  fontSize: 12, fontWeight: 700, padding: '6px 14px',
                  cursor: 'pointer', transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.18)';
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.45)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
                }}
              >
                ✕&nbsp; Close &amp; Return to Map
              </button>
            </div>
          )}

          {/* ── Scrollable content ── */}
          <div className="sidebar" style={{ flex: 1, borderLeft: 'none' }}>

            {/* Panel 1 — Config */}
            <AnalysisPanel
              coords={selectedCoords}
              onAnalyze={handleAnalyze}
              loading={isLoading}
              externalPanelArea={drawnArea}
            />

            {/* Loading */}
            {isLoading && (
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="loading-spinner" />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{loadingStage}</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
                <p style={{ fontSize: 13, color: '#f87171' }}>⚠️ {error}</p>
              </div>
            )}

            {/* Panel 2 — Placement Score */}
            <ResultsPanel results={placementData} loading={isLoading} />

            {/* Panel 3 — ROI + Subsidy */}
            <ROIComponent roi={roiData} loading={isLoading} />

            {/* Panel 4 — Seasonal Time-Series */}
            {selectedCoords && pipelineResult && (
              <SeasonalChart
                lat={selectedCoords.lat}
                lng={selectedCoords.lng}
                plantSizeKw={pipelineResult.plant_size_kw || 10}
                token={token}
              />
            )}

            {/* Panel 5 — AI Summary */}
            <SummaryComponent summary={summaryData} loading={isLoading} />

            {/* Panel 6 — Smart Energy Dashboard (Pro+) */}
            {(pipelineResult || user) && (
              <EnergyDashboard
                analysisResult={pipelineResult}
                onUpgrade={() => setShowBilling(true)}
              />
            )}

          </div>{/* end inner scrollable sidebar */}
        </div>{/* end outer sidebar wrapper */}
      </div>{/* end main-content */}
    </div>
  );
}

// ── Root export with AuthProvider wrapper ─────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
