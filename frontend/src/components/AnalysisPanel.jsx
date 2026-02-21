import { useState, useEffect } from 'react';

// ── Indian market installation cost rates ─────────────────────────────────
// Source: MNRE/DISCOM benchmarks
// Polycrystalline: ₹45k/kWp → ~6 m²/kWp → ₹7,500/m²
// Monocrystalline: ₹52k/kWp → ₹8,667/m²
// Bifacial:        ₹60k/kWp → ₹10,000/m²  (higher yield)
const PANEL_TYPES = [
    {
        id: 'standard',
        label: '☀️ Standard',
        sublabel: 'Polycrystalline',
        efficiency: 0.16,
        costPerM2: 7500,
        desc: '15-17% efficiency · Budget-friendly · Most common',
    },
    {
        id: 'premium',
        label: '⚡ Premium',
        sublabel: 'Monocrystalline',
        efficiency: 0.20,
        costPerM2: 8800,
        desc: '19-21% efficiency · High performance · Recommended',
    },
    {
        id: 'highend',
        label: '🚀 High-End',
        sublabel: 'Bifacial Mono',
        efficiency: 0.22,
        costPerM2: 11000,
        desc: '21-24% efficiency · Best ROI · Large installations',
    },
    {
        id: 'custom',
        label: '✏️ Custom',
        sublabel: 'Manual input',
        efficiency: null,   // user sets manually
        costPerM2: null,
        desc: 'Set your own efficiency & cost per m²',
    },
];

export default function AnalysisPanel({ coords, onAnalyze, loading, externalPanelArea }) {
    const [panelType, setPanelType] = useState('premium');
    const [panelArea, setPanelArea] = useState(80);
    const [efficiency, setEfficiency] = useState(0.20);
    const [electricityRate, setElectricityRate] = useState(8.0);
    const [installationCost, setInstallationCost] = useState(80 * 8800); // auto from area × costPerM2
    const [costPerM2, setCostPerM2] = useState(8800);
    const [areaAutoSet, setAreaAutoSet] = useState(false);
    const [customEfficiency, setCustomEfficiency] = useState(20);

    // Plant size (kW) — primary capacity input
    const [plantSizeKw, setPlantSizeKw] = useState(10);
    const [customPlantKw, setCustomPlantKw] = useState(10);
    const [plantSizeMode, setPlantSizeMode] = useState('preset'); // 'preset' | 'custom'

    const PLANT_PRESETS = [10, 20, 30, 50];
    const activePlantKw = plantSizeMode === 'custom' ? customPlantKw : plantSizeKw;
    const requiredLandM2 = Math.round(activePlantKw * 8);
    const estimatedCostLakh = (activePlantKw * 50000 / 100000).toFixed(1); // ₹50k/kW

    // ── Sync when external area arrives from map polygon ────────────────────
    useEffect(() => {
        if (externalPanelArea != null && externalPanelArea > 0) {
            const area = Math.round(externalPanelArea);
            setPanelArea(area);
            setInstallationCost(Math.round(area * costPerM2));
            setAreaAutoSet(true);
        } else {
            setAreaAutoSet(false);
        }
    }, [externalPanelArea, costPerM2]);

    // ── When panel type changes, sync efficiency & costPerM2 ───────────────
    const handleTypeChange = (typeId) => {
        setPanelType(typeId);
        const type = PANEL_TYPES.find(t => t.id === typeId);
        if (type.id !== 'custom') {
            setEfficiency(type.efficiency);
            setCostPerM2(type.costPerM2);
            setInstallationCost(Math.round(panelArea * type.costPerM2));
        }
    };

    // ── When panel area changes, auto-recalculate install cost ─────────────
    const handleAreaChange = (val) => {
        const area = Number(val);
        setPanelArea(area);
        setAreaAutoSet(false);
        if (panelType !== 'custom') {
            setInstallationCost(Math.round(area * costPerM2));
        }
    };

    // ── When costPerM2 changes (custom), recalculate total ─────────────────
    const handleCostPerM2Change = (val) => {
        const rate = Number(val);
        setCostPerM2(rate);
        setInstallationCost(Math.round(panelArea * rate));
    };

    const handleAnalyze = () => {
        if (!coords) return;
        const eff = panelType === 'custom' ? customEfficiency / 100 : efficiency;
        onAnalyze({
            panelArea,
            efficiency: eff,
            electricityRate,
            installationCost: installationCost > 0 ? installationCost : 0,
            plantSizeKw: activePlantKw,
        });
    };

    const selectedType = PANEL_TYPES.find(t => t.id === panelType);

    return (
        <div className="card">
            <div className="card-header">
                <div className="card-icon solar">📍</div>
                <div className="card-title">Location & Configuration</div>
            </div>

            {/* Coordinates */}
            <div className="coord-display">
                {['Latitude', 'Longitude'].map((label, i) => {
                    const val = coords ? (i === 0 ? coords.lat : coords.lng).toFixed(5) + '°' : '—';
                    return (
                        <div key={label} className="coord-item">
                            <div className="coord-label">{label}</div>
                            <div className={`coord-value ${!coords ? 'empty-coord' : ''}`}>{val}</div>
                        </div>
                    );
                })}
            </div>

            {/* ── Plant Size Capacity Selector ─────────────────────── */}
            <div style={{ marginBottom: 16 }}>
                <div className="form-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    🏭 Plant Capacity (kW)
                    <span style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>drives ROI &amp; land calc</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {PLANT_PRESETS.map(kw => (
                        <button
                            key={kw}
                            onClick={() => { setPlantSizeKw(kw); setPlantSizeMode('preset'); }}
                            style={{
                                flex: 1, padding: '8px 4px',
                                background: (plantSizeMode === 'preset' && plantSizeKw === kw)
                                    ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${(plantSizeMode === 'preset' && plantSizeKw === kw)
                                    ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: 8, cursor: 'pointer',
                                color: (plantSizeMode === 'preset' && plantSizeKw === kw) ? '#10b981' : '#94a3b8',
                                fontWeight: 700, fontSize: 13,
                                transition: 'all 0.15s',
                            }}
                        >
                            {kw}kW
                        </button>
                    ))}
                    <button
                        onClick={() => setPlantSizeMode('custom')}
                        style={{
                            flex: 1, padding: '8px 4px',
                            background: plantSizeMode === 'custom' ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${plantSizeMode === 'custom' ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: 8, cursor: 'pointer',
                            color: plantSizeMode === 'custom' ? '#8b5cf6' : '#94a3b8',
                            fontWeight: 700, fontSize: 12,
                            transition: 'all 0.15s',
                        }}
                    >
                        Custom
                    </button>
                </div>
                {plantSizeMode === 'custom' && (
                    <input
                        type="number" className="form-input"
                        value={customPlantKw}
                        onChange={e => setCustomPlantKw(Math.max(1, Number(e.target.value)))}
                        placeholder="Enter kW" min={1} max={10000} step={1}
                        style={{ marginBottom: 6 }}
                    />
                )}
                {/* Land + cost preview */}
                <div style={{
                    display: 'flex', gap: 8, fontSize: 11,
                    color: '#64748b', padding: '5px 8px',
                    background: 'rgba(255,255,255,0.03)', borderRadius: 6,
                }}>
                    <span>📐 ~{requiredLandM2.toLocaleString()} m² land</span>
                    <span style={{ marginLeft: 'auto' }}>💰 ~₹{estimatedCostLakh}L est.</span>
                </div>
            </div>

            {/* Panel Type Selector */}
            <div style={{ marginBottom: 14 }}>
                <div className="form-label" style={{ marginBottom: 8 }}>Panel Type</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {PANEL_TYPES.map(type => (
                        <button
                            key={type.id}
                            onClick={() => handleTypeChange(type.id)}
                            title={type.desc}
                            style={{
                                background: panelType === type.id
                                    ? 'rgba(245,158,11,0.15)'
                                    : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${panelType === type.id ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.06)'}`,
                                borderRadius: 8,
                                padding: '8px 10px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s',
                            }}
                        >
                            <div style={{ fontSize: 12, fontWeight: 700, color: panelType === type.id ? '#f59e0b' : '#f1f5f9' }}>
                                {type.label}
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                {type.sublabel}
                                {type.efficiency && ` · ${Math.round(type.efficiency * 100)}%`}
                            </div>
                        </button>
                    ))}
                </div>
                {selectedType && selectedType.id !== 'custom' && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                        ℹ️ {selectedType.desc}
                    </div>
                )}
            </div>

            {/* Panel Area */}
            <div className="form-row">
                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Panel Area (m²)
                        {areaAutoSet && (
                            <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                                ✓ From map
                            </span>
                        )}
                    </label>
                    <input
                        type="number"
                        className="form-input"
                        value={panelArea}
                        onChange={e => handleAreaChange(e.target.value)}
                        style={areaAutoSet ? { borderColor: 'rgba(16,185,129,0.5)' } : {}}
                        min={1}
                        max={10_000_000}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Efficiency (%)</label>
                    {panelType === 'custom' ? (
                        <input
                            type="number"
                            className="form-input"
                            value={customEfficiency}
                            onChange={e => setCustomEfficiency(Number(e.target.value))}
                            min={5} max={40} step={0.5}
                        />
                    ) : (
                        <input
                            type="number"
                            className="form-input"
                            value={Math.round(efficiency * 100)}
                            readOnly
                            style={{ opacity: 0.6, cursor: 'not-allowed' }}
                            title={`Set by ${selectedType?.sublabel} panel type`}
                        />
                    )}
                </div>
            </div>

            {/* Cost inputs */}
            <div className="form-row">
                <div className="form-group">
                    <label className="form-label">Electricity Rate (₹/kWh)</label>
                    <input
                        type="number"
                        className="form-input"
                        value={electricityRate}
                        onChange={e => setElectricityRate(Number(e.target.value))}
                        min={1} max={30} step={0.5}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Cost/m² (₹)
                        {panelType !== 'custom' && (
                            <span style={{ fontSize: 10, color: '#64748b' }}>auto</span>
                        )}
                    </label>
                    <input
                        type="number"
                        className="form-input"
                        value={costPerM2}
                        onChange={e => handleCostPerM2Change(e.target.value)}
                        readOnly={panelType !== 'custom'}
                        style={panelType !== 'custom' ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                        min={1000} step={500}
                    />
                </div>
            </div>

            {/* Auto-calculated total cost display */}
            <div style={{
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Est. Installation Cost
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b', fontFamily: "'Space Grotesk', sans-serif" }}>
                        ₹{installationCost.toLocaleString('en-IN')}
                    </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>
                    {panelArea.toLocaleString()} m²<br />
                    × ₹{costPerM2.toLocaleString()}/m²
                </div>
            </div>

            <button
                className="btn btn-primary"
                onClick={handleAnalyze}
                disabled={!coords || loading}
                id="analyze-btn"
            >
                {loading ? (
                    <><span className="loading-spinner" /> Analyzing...</>
                ) : (
                    <>⚡ Analyze Location</>
                )}
            </button>
        </div>
    );
}
