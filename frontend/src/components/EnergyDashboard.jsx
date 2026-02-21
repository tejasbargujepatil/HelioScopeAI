import { useState, useEffect } from 'react';
import {
    AreaChart, Area, BarChart, Bar, ComposedChart, Line,
    XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import ProGate from './ProGate';
import { useAuth } from '../context/AuthContext';
import api from '../services/apiService';

const TABS = [
    { id: 'live', icon: '⚡', label: 'Live' },
    { id: 'seasonal', icon: '🌞', label: 'Seasonal' },
    { id: 'forecast', icon: '🔮', label: 'Forecast' },
    { id: 'surplus', icon: '♻️', label: 'Surplus' },
    { id: 'carbon', icon: '🌿', label: 'Carbon' },
    { id: 'p2p', icon: '🤝', label: 'P2P Trade', enterprise: true },
    { id: 'blockchain', icon: '⛓️', label: 'Ledger', enterprise: true },
];

const fmt = (n) => n?.toLocaleString('en-IN') ?? '—';
const fmtINR = (n) => `₹${fmt(Math.round(n))}`;

// ── Custom Tooltip ─────────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: 'rgba(10,22,40,0.95)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '8px 12px', fontSize: 12,
        }}>
            <div style={{ color: '#64748b', marginBottom: 4 }}>{label}</div>
            {payload.map(p => (
                <div key={p.name} style={{ color: p.color, fontWeight: 700 }}>
                    {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
                </div>
            ))}
        </div>
    );
};

// ── Individual Tabs ────────────────────────────────────────────────────────
function LiveTab({ data }) {
    const totalToday = data?.hourly_generation?.reduce((s, h) => s + h.energy_kwh, 0) ?? 0;
    const currentHour = new Date().getHours();
    const current = data?.hourly_generation?.[currentHour];

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                {[
                    { label: '⚡ Now', value: `${current?.power_kw?.toFixed(2) ?? '—'} kW`, color: '#f59e0b' },
                    { label: '☀️ Today Total', value: `${totalToday.toFixed(1)} kWh`, color: '#10b981' },
                    { label: '💸 Today Savings', value: fmtINR(data?.daily_kwh ?? totalToday * 8), color: '#6366f1' },
                    { label: '📅 Annual', value: `${fmt(Math.round(data?.annual_kwh ?? 0))} kWh`, color: '#94a3b8' },
                ].map(m => (
                    <div key={m.label} style={{
                        background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 19, fontWeight: 800, color: m.color }}>{m.value}</div>
                    </div>
                ))}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>24-Hour Power Generation (kW)</div>
            <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data?.hourly_generation ?? []}>
                    <defs>
                        <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} interval={3} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} width={40} />
                    <Tooltip content={<DarkTooltip />} />
                    <ReferenceLine x={`${String(currentHour).padStart(2, '0')}:00`} stroke="#f59e0b" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="power_kw" name="Power" stroke="#f59e0b" fill="url(#powerGrad)" strokeWidth={2} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

function ForecastTab({ data }) {
    return (
        <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>7-Day Energy Forecast (kWh/day)</div>
            <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.weekly_forecast ?? []}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} width={45} />
                    <Tooltip content={<DarkTooltip />} />
                    <Bar dataKey="energy_kwh" name="kWh" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                {(data?.weekly_forecast ?? []).map(d => (
                    <div key={d.day} style={{
                        flex: '1 1 80px', background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                        padding: '8px 10px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{d.day}</div>
                        <div style={{ fontSize: 12, color: d.weather === 'Sunny' ? '#f59e0b' : d.weather === 'Partly Cloudy' ? '#94a3b8' : '#64748b', marginTop: 2 }}>
                            {d.weather === 'Sunny' ? '☀️' : d.weather === 'Partly Cloudy' ? '⛅' : '☁️'}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', marginTop: 4 }}>{d.energy_kwh}</div>
                        <div style={{ fontSize: 10, color: '#475569' }}>kWh</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SurplusTab({ data }) {
    const s = data?.surplus;
    if (!s) return null;
    const pct = s.self_sufficiency_pct;
    return (
        <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Self-Sufficiency</div>
                <div style={{ fontSize: 48, fontWeight: 900, color: pct >= 100 ? '#10b981' : '#f59e0b' }}>
                    {pct.toFixed(0)}%
                </div>
                <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 100, height: 10, margin: '12px 0' }}>
                    <div style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? '#10b981' : '#f59e0b', borderRadius: 100, height: '100%', transition: 'width 0.8s' }} />
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                    { label: '☀️ Solar Generated', value: `${s.solar_kwh} kWh`, color: '#f59e0b' },
                    { label: '🏠 Household Need', value: `${s.household_kwh} kWh`, color: '#94a3b8' },
                    {
                        label: s.is_surplus ? '💚 Grid Export' : '🔌 Grid Import',
                        value: `${s.is_surplus ? s.grid_export_kwh : s.grid_import_kwh} kWh`,
                        color: s.is_surplus ? '#10b981' : '#ef4444'
                    },
                ].map(m => (
                    <div key={m.label} style={{
                        background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 10px',
                        border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>{m.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{m.value}</div>
                    </div>
                ))}
            </div>
            {s.is_surplus && (
                <div style={{
                    marginTop: 14, padding: '12px 14px', background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, fontSize: 12, color: '#10b981'
                }}>
                    ✅ <strong>Surplus detected!</strong> You have <strong>{s.grid_export_kwh} kWh</strong> available for net metering or P2P sale.
                </div>
            )}
        </div>
    );
}

function CarbonTab({ data }) {
    const c = data?.carbon;
    if (!c) return null;
    return (
        <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🌿</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#10b981' }}>
                    {c.co2_tonnes_per_year} <span style={{ fontSize: 18, fontWeight: 400 }}>tonnes CO₂/yr</span>
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>avoided vs India grid (0.82 kg CO₂/kWh)</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                    { icon: '🌳', label: 'Trees Equivalent', value: `${fmt(c.trees_equivalent_year)} trees/yr`, color: '#10b981' },
                    { icon: '🚗', label: 'Cars Off Road', value: `${c.cars_off_road_year} cars/yr`, color: '#6366f1' },
                    { icon: '📅', label: '25-Year Impact', value: `${c.co2_tonnes_25yr} tonnes CO₂`, color: '#f59e0b' },
                    { icon: '♻️', label: 'Annual CO₂ Saved', value: `${c.co2_kg_per_year} kg`, color: '#94a3b8' },
                ].map(m => (
                    <div key={m.label} style={{
                        background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '16px 14px',
                        border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>{m.icon}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: m.color, marginBottom: 4 }}>{m.value}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>{m.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function P2PTab({ data, onUpgrade }) {
    return (
        <ProGate tier="enterprise" onUpgrade={onUpgrade}>
            <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                    🤝 Nearby buyers ready to purchase your surplus energy
                </div>
                {(data?.p2p_market ?? []).length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#475569', padding: 24 }}>
                        No surplus energy available for trading today.
                    </div>
                ) : (data?.p2p_market ?? []).map((b, i) => (
                    <div key={i} style={{
                        background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px',
                        border: '1px solid rgba(255,255,255,0.06)', marginBottom: 10,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <div>
                            <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 13 }}>{b.name}</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                Wants {b.demand_kwh} kWh · ₹{b.offer_rate.toFixed(2)}/kWh
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#10b981' }}>{fmtINR(b.earnings_inr)}</div>
                            <div style={{ fontSize: 10, color: '#475569' }}>{b.fulfilled_kwh} kWh sold</div>
                        </div>
                    </div>
                ))}
            </div>
        </ProGate>
    );
}

function BlockchainTab({ data, onUpgrade }) {
    return (
        <ProGate tier="enterprise" onUpgrade={onUpgrade}>
            <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                    ⛓️ Immutable transaction ledger — all energy trades recorded on-chain
                </div>
                {(data?.blockchain_ledger ?? []).map((b, i) => (
                    <div key={i} style={{
                        background: 'rgba(255,255,255,0.025)', borderRadius: 8, padding: '10px 12px',
                        border: '1px solid rgba(255,255,255,0.05)', marginBottom: 8, fontSize: 11,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ color: '#6366f1', fontWeight: 700 }}>Block #{b.block}</span>
                            <span style={{ color: '#10b981', fontWeight: 700 }}>✓ {b.status}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                            <span style={{ color: '#64748b' }}>Type: <span style={{ color: '#f1f5f9' }}>{b.type}</span></span>
                            <span style={{ color: '#64748b' }}>kWh: <span style={{ color: '#f59e0b' }}>{b.kwh}</span></span>
                            <span style={{ color: '#64748b' }}>Party: <span style={{ color: '#94a3b8' }}>{b.party}</span></span>
                            <span style={{ color: '#64748b' }}>Time: <span style={{ color: '#475569' }}>{b.timestamp}</span></span>
                        </div>
                        <div style={{ marginTop: 6, color: '#334155', fontFamily: 'monospace', fontSize: 10 }}>
                            Hash: {b.hash}
                        </div>
                    </div>
                ))}
            </div>
        </ProGate>
    );
}

// ── Seasonal Tab ───────────────────────────────────────────────────────────
function SeasonalTab({ seasonal, loading }) {
    if (loading) return <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>Loading seasonal data...</div>;
    if (!seasonal) return <div style={{ textAlign: 'center', padding: 20, color: '#475569' }}>No seasonal data yet. Run an analysis first.</div>;

    const stab = (seasonal.stability_index * 100).toFixed(1);
    const stabColor = stab >= 80 ? '#10b981' : stab >= 60 ? '#f59e0b' : '#ef4444';

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
                {[
                    { label: '☀️ Peak', value: seasonal.peak_month, sub: `${seasonal.peak_irradiance} kWh/m²/d`, color: '#f59e0b' },
                    { label: '🌧️ Low', value: seasonal.low_month, sub: `${seasonal.low_irradiance} kWh/m²/d`, color: '#64748b' },
                    { label: '📊 Annual', value: `${fmt(Math.round(seasonal.annual_total_kwh))} kWh`, sub: 'total generation', color: '#6366f1' },
                    { label: '🎯 Stability', value: `${stab}%`, sub: '1 − CoV index', color: stabColor },
                ].map(m => (
                    <div key={m.label} style={{
                        background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px',
                        border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{m.value}</div>
                        <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{m.sub}</div>
                    </div>
                ))}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                Monthly Solar Irradiance (kWh/m²/d) + Generation (kWh)
            </div>
            <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={seasonal.monthly_summary}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 10 }} />
                    <YAxis yAxisId="gen" tick={{ fill: '#475569', fontSize: 10 }} width={50} />
                    <YAxis yAxisId="irr" orientation="right" tick={{ fill: '#f59e0b', fontSize: 10 }} width={40} domain={[0, 9]} unit=" kWh" />
                    <Tooltip content={<DarkTooltip />} />
                    <Bar yAxisId="gen" dataKey="generation_kwh" name="Generation kWh" fill="#6366f1" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                    <Line yAxisId="irr" type="monotone" dataKey="irradiance_kwh_m2_day" name="Irradiance" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
                </ComposedChart>
            </ResponsiveContainer>
            <div style={{
                marginTop: 14, padding: '10px 14px',
                background: stab >= 70 ? 'rgba(16,185,129,0.07)' : 'rgba(245,158,11,0.07)',
                border: `1px solid ${stab >= 70 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                borderRadius: 10, fontSize: 12, color: stabColor,
            }}>
                {stab >= 70
                    ? `✅ High stability (${stab}%) — varies ±${seasonal.cov_pct}% across months. Ideal for consistent grid supply.`
                    : `⚠️ Moderate variability (${stab}%) — ${seasonal.cov_pct}% CoV. Consider storage for monsoon months.`
                }
            </div>
        </div>
    );
}

// ── Main EnergyDashboard ───────────────────────────────────────────────────
export default function EnergyDashboard({ analysisResult, onUpgrade }) {
    const { user, token } = useAuth();
    const [tab, setTab] = useState('live');
    const [data, setData] = useState(null);
    const [seasonal, setSeasonal] = useState(null);
    const [loading, setLoading] = useState(false);
    const [seasonalLoading, setSeasonalLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!analysisResult || !user || (user.tier === 'free')) return;
        setLoading(true);
        setError('');
        api.post('/api/energy/dashboard', {
            solar_irradiance: analysisResult.solar_irradiance,
            panel_area: analysisResult.panel_area ?? 100,
            efficiency: analysisResult.efficiency ?? 0.20,
            electricity_rate: analysisResult.electricity_rate ?? 8.0,
            energy_per_year: analysisResult.energy_output_kwh_per_year,
        }, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => setData(r.data))
            .catch(e => setError(e?.response?.data?.error || 'Failed to load energy data.'))
            .finally(() => setLoading(false));
    }, [analysisResult, user?.tier]);

    // Fetch seasonal data whenever analysis result changes
    useEffect(() => {
        if (!analysisResult?.lat || !analysisResult?.lng) return;
        setSeasonalLoading(true);
        const kw = analysisResult.plant_size_kw || 10;
        api.get(`/api/seasonal?lat=${analysisResult.lat}&lng=${analysisResult.lng}&plant_size_kw=${kw}`)
            .then(r => setSeasonal(r.data))
            .catch(() => { })
            .finally(() => setSeasonalLoading(false));
    }, [analysisResult?.lat, analysisResult?.lng, analysisResult?.plant_size_kw]);

    return (
        <div className="card fade-in">
            <div className="card-header">
                <div className="card-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>🔆</div>
                <div className="card-title">Smart Energy Dashboard</div>
                {user?.tier && (
                    <span style={{
                        marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                        background: user.tier === 'enterprise' ? 'rgba(99,102,241,0.15)' : user.tier === 'pro' ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
                        color: user.tier === 'enterprise' ? '#6366f1' : user.tier === 'pro' ? '#f59e0b' : '#64748b',
                    }}>{user.tier.toUpperCase()}</span>
                )}
            </div>

            {/* Feature gate for free users */}
            {(!user || user.tier === 'free') ? (
                <ProGate tier="pro" onUpgrade={onUpgrade} />
            ) : (
                <>
                    {/* Tab bar */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 18, flexWrap: 'wrap' }}>
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                style={{
                                    padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                    fontSize: 12, fontWeight: 700,
                                    background: tab === t.id ? 'rgba(99,102,241,0.7)' : 'rgba(255,255,255,0.04)',
                                    color: tab === t.id ? '#fff' : '#64748b',
                                    transition: 'all 0.15s',
                                }}>
                                {t.icon} {t.label}
                                {t.enterprise && user.tier !== 'enterprise' && <span style={{ marginLeft: 4, fontSize: 9 }}>🔒</span>}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    {loading ? (
                        <div className="loading-dots">
                            <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
                        </div>
                    ) : error ? (
                        <div style={{ color: '#ef4444', fontSize: 12, padding: 16 }}>{error}</div>
                    ) : data ? (
                        <>
                            {tab === 'live' && <LiveTab data={data} />}
                            {tab === 'seasonal' && <SeasonalTab seasonal={seasonal} loading={seasonalLoading} />}
                            {tab === 'forecast' && <ForecastTab data={data} />}
                            {tab === 'surplus' && <SurplusTab data={data} />}
                            {tab === 'carbon' && <CarbonTab data={data} />}
                            {tab === 'p2p' && <P2PTab data={data} onUpgrade={onUpgrade} />}
                            {tab === 'blockchain' && <BlockchainTab data={data} onUpgrade={onUpgrade} />}
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', color: '#475569', padding: 24, fontSize: 13 }}>
                            Run an analysis to load the energy dashboard.
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
