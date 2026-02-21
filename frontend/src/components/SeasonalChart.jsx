import { useEffect, useState, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, LineChart, Line, Legend,
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ─── Custom Tooltip ─────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#0f172a', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 10, padding: '10px 14px', fontSize: 12,
        }}>
            <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></div>
            ))}
        </div>
    );
}

/* ─── Stability Badge ─────────────────────────────────────────────── */
function StabilityBadge({ index, cv }) {
    const color = index >= 80 ? '#10b981' : index >= 60 ? '#f59e0b' : '#ef4444';
    const label = index >= 80 ? 'Very Stable' : index >= 60 ? 'Moderate' : 'Seasonal Variation';
    return (
        <div style={{
            display: 'flex', gap: 12, alignItems: 'center',
            padding: '10px 16px',
            background: `${color}18`, border: `1px solid ${color}40`,
            borderRadius: 10, marginTop: 12,
        }}>
            <div style={{ fontSize: 20 }}>📊</div>
            <div>
                <div style={{ fontSize: 13, fontWeight: 700, color }}>
                    Seasonal Stability: {index}/100 — {label}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                    Coefficient of variation: {cv}% (lower = more consistent year-round)
                </div>
            </div>
        </div>
    );
}

/* ─── Main Component ──────────────────────────────────────────────── */
export default function SeasonalChart({ lat, lng, plantSizeKw = 10, token }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [view, setView] = useState('generation'); // 'irradiance' | 'generation' | 'tariff'
    const [tariff, setTariff] = useState(8);
    const [sensitData, setSensitData] = useState(null);

    const fetchSeasonal = useCallback(async () => {
        if (!lat || !lng) return;
        setLoading(true); setError('');
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const r = await fetch(
                `${API_BASE}/api/seasonal?lat=${lat}&lng=${lng}&plant_size_kw=${plantSizeKw}`,
                { headers }
            );
            if (!r.ok) throw new Error('API error');
            setData(await r.json());
        } catch (e) {
            setError('Could not load seasonal data.');
        } finally {
            setLoading(false);
        }
    }, [lat, lng, plantSizeKw, token]);

    // Auto-fetch when coords change
    useEffect(() => { fetchSeasonal(); }, [fetchSeasonal]);

    // Tariff sensitivity chart
    const fetchSensitivity = useCallback(async () => {
        if (!lat || !lng || !data) return;
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const r = await fetch(`${API_BASE}/api/roi/sensitivity`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify({
                    lat, lng,
                    plant_size_kw: plantSizeKw,
                    solar_irradiance: data.annual_mean_irradiance,
                    installation_cost: plantSizeKw * 50000,
                }),
            });
            if (!r.ok) throw new Error('Sensitivity API error');
            const d = await r.json();
            setSensitData(d.sensitivity);
        } catch { }
    }, [lat, lng, data, plantSizeKw, token]);

    useEffect(() => {
        if (view === 'tariff') fetchSensitivity();
    }, [view, fetchSensitivity]);

    if (!lat || !lng) return null;

    /* ─── Chart data ──────────────────────────────────────────────── */
    const chartData = data ? MONTHS.map((m, i) => ({
        month: m,
        irradiance: data.monthly_irradiance?.[i] ?? 0,
        generation: data.monthly_gen_kwh?.[i] ?? 0,
        savings: Math.round((data.monthly_gen_kwh?.[i] ?? 0) * tariff),
    })) : [];

    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(16,185,129,0.15)',
            borderRadius: 16, padding: 20, marginTop: 16,
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>📅 Seasonal Analysis</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                        12-month solar profile · {plantSizeKw} kW plant
                    </div>
                </div>
                {/* View toggle */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                        { id: 'irradiance', label: '☀️ Irradiance' },
                        { id: 'generation', label: '⚡ Generation' },
                        { id: 'tariff', label: '₹ Tariff Sensitivity' },
                    ].map(v => (
                        <button key={v.id} onClick={() => setView(v.id)} style={{
                            padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                            cursor: 'pointer', border: 'none',
                            background: view === v.id ? '#10b981' : 'rgba(255,255,255,0.05)',
                            color: view === v.id ? '#fff' : '#64748b',
                            transition: 'all 0.15s',
                        }}>{v.label}</button>
                    ))}
                </div>
            </div>

            {/* Loading / error */}
            {loading && <div style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>Loading seasonal data...</div>}
            {error && <div style={{ color: '#ef4444', fontSize: 12, padding: 8 }}>{error}</div>}

            {/* Peak / Trough info */}
            {data && view !== 'tariff' && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    {[
                        { icon: '🔆', label: 'Peak Month', val: data.peak_month, sub: `${data.peak_irradiance} kWh/m²/d`, color: '#f59e0b' },
                        { icon: '🌑', label: 'Trough Month', val: data.trough_month, sub: `${data.trough_irradiance} kWh/m²/d`, color: '#6366f1' },
                        { icon: '📊', label: 'Annual Mean', val: `${data.annual_mean_irradiance}`, sub: 'kWh/m²/day', color: '#10b981' },
                        { icon: '⚡', label: 'Annual Yield', val: data.annual_total_kwh?.toLocaleString(), sub: 'kWh/yr', color: '#3b82f6' },
                    ].map((s, i) => (
                        <div key={i} style={{
                            flex: '1 1 100px', padding: '10px 14px',
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid ${s.color}30`, borderRadius: 10,
                        }}>
                            <div style={{ fontSize: 14 }}>{s.icon}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.val}</div>
                            <div style={{ fontSize: 10, color: '#475569' }}>{s.sub}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Charts */}
            {data && view === 'irradiance' && (
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} margin={{ left: -10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} unit=" kWh" />
                        <Tooltip content={<ChartTooltip />} />
                        <ReferenceLine y={data.annual_mean_irradiance} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'mean', fill: '#f59e0b', fontSize: 10 }} />
                        <Bar dataKey="irradiance" name="Irradiance (kWh/m²/d)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            )}

            {data && view === 'generation' && (
                <>
                    {/* Tariff for savings calc */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <label style={{ fontSize: 12, color: '#64748b' }}>₹/kWh tariff for savings:</label>
                        <input type="range" min="4" max="15" step="0.5" value={tariff}
                            onChange={e => setTariff(Number(e.target.value))}
                            style={{ accentColor: '#10b981', flex: 1 }} />
                        <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700, minWidth: 30 }}>₹{tariff}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} margin={{ left: -10, right: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                            <YAxis yAxisId="kwh" tick={{ fontSize: 10, fill: '#64748b' }} unit=" kWh" />
                            <YAxis yAxisId="inr" orientation="right" tick={{ fontSize: 10, fill: '#f59e0b' }} unit=" ₹" />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar yAxisId="kwh" dataKey="generation" name="Generation (kWh)" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="inr" dataKey="savings" name="Savings (₹)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </>
            )}

            {view === 'tariff' && (
                sensitData ? (
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={sensitData} margin={{ left: -10, right: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="tariff_rate" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `₹${v}`} />
                            <YAxis yAxisId="payback" tick={{ fontSize: 10, fill: '#6366f1' }} unit=" yr" />
                            <YAxis yAxisId="savings" orientation="right" tick={{ fontSize: 10, fill: '#10b981' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line yAxisId="payback" dataKey="payback_years" name="Payback (yrs)" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                            <Line yAxisId="savings" dataKey="annual_savings_inr" name="Annual Savings (₹)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: 12, padding: 24 }}>Loading sensitivity data...</div>
                )
            )}

            {/* Stability badge */}
            {data && <StabilityBadge index={data.stability_index} cv={data.cv_percent} />}
        </div>
    );
}
