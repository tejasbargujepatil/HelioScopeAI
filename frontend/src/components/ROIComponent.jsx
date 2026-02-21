const formatINR = (amount) => {
    if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)}Cr`;
    if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
    if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
};

// Subsidy tier label lookup
function subsidyTier(kwp) {
    if (kwp <= 1) return '1 kWp tier';
    if (kwp <= 2) return '2 kWp tier';
    if (kwp <= 3) return '3 kWp tier';
    return '3+ kWp (capped)';
}

export default function ROIComponent({ roi, loading }) {
    if (loading) {
        return (
            <div className="card fade-in">
                <div className="card-header">
                    <div className="card-icon green">💰</div>
                    <div className="card-title">ROI Analysis</div>
                </div>
                <div className="loading-dots">
                    <div className="loading-dot" />
                    <div className="loading-dot" />
                    <div className="loading-dot" />
                </div>
            </div>
        );
    }

    if (!roi) {
        return (
            <div className="card">
                <div className="card-header">
                    <div className="card-icon green">💰</div>
                    <div className="card-title">ROI Analysis</div>
                </div>
                <div className="empty-state">
                    <div className="empty-icon">📈</div>
                    <div className="empty-title">ROI Pending</div>
                    <div className="empty-desc">Run an analysis to see investment returns</div>
                </div>
            </div>
        );
    }

    const hasSubsidy = roi.subsidy_amount_inr > 0;

    return (
        <div className="card fade-in">
            <div className="card-header">
                <div className="card-icon green">💰</div>
                <div className="card-title">ROI Analysis</div>
                {roi.system_size_kwp && (
                    <span style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        background: 'rgba(16,185,129,0.15)',
                        color: '#10b981',
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontWeight: 700,
                    }}>
                        {roi.system_size_kwp} kWp
                    </span>
                )}
            </div>

            {/* ── Daily savings highlight ────────────────────────────────────── */}
            {roi.daily_savings_inr > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(59,130,246,0.08) 100%)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    marginBottom: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <div>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
                            💡 Estimated Money Saved Today
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
                            ₹{Math.round(roi.daily_savings_inr).toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                            every day for 25 years
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
                        <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: 16 }}>{formatINR(roi.annual_savings_inr)}</div>
                        <div>per year</div>
                    </div>
                </div>
            )}

            {/* ── PM Surya Ghar subsidy box ──────────────────────────────────── */}
            {hasSubsidy && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(251,191,36,0.06) 100%)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    marginBottom: 14,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                🏛️ PM Surya Ghar Subsidy (CFA)
                                <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '1px 5px', borderRadius: 4 }}>
                                    MNRE 2026
                                </span>
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>
                                {subsidyTier(roi.system_size_kwp)} · DCR-compliant panels required
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b', fontFamily: "'Space Grotesk', sans-serif" }}>
                                {formatINR(roi.subsidy_amount_inr)}
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>Central Govt. CFA</div>
                        </div>
                    </div>

                    {/* Cost comparison: pre vs post subsidy */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto 1fr',
                        gap: 8,
                        marginTop: 12,
                        padding: '10px 0 0',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        alignItems: 'center',
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: '#475569', marginBottom: 2 }}>Pre-Subsidy Payback</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8' }}>
                                {roi.payback_years === Infinity ? '∞' : `${roi.payback_years}y`}
                            </div>
                        </div>
                        <div style={{ color: '#10b981', fontSize: 16, textAlign: 'center' }}>→</div>
                        <div style={{ textAlign: 'center', background: 'rgba(16,185,129,0.08)', borderRadius: 8, padding: '6px 4px' }}>
                            <div style={{ fontSize: 10, color: '#10b981', marginBottom: 2, fontWeight: 600 }}>After Subsidy</div>
                            <div style={{ fontSize: 17, fontWeight: 800, color: '#10b981' }}>
                                {roi.payback_years_after_subsidy === Infinity ? '∞' : `${roi.payback_years_after_subsidy}y`}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Main ROI grid ──────────────────────────────────────────────── */}
            <div className="roi-grid">
                <div className="roi-metric payback">
                    <div className="roi-metric-icon">⏱️</div>
                    <div className="roi-metric-value">
                        {hasSubsidy
                            ? (roi.payback_years_after_subsidy === Infinity ? '∞' : `${roi.payback_years_after_subsidy}y`)
                            : (roi.payback_years === Infinity ? '∞' : `${roi.payback_years}y`)}
                    </div>
                    <div className="roi-metric-label">
                        {hasSubsidy ? 'Payback (Post-Subsidy)' : 'Payback Period'}
                    </div>
                </div>

                <div className="roi-metric annual">
                    <div className="roi-metric-icon">📅</div>
                    <div className="roi-metric-value">{formatINR(roi.annual_savings_inr)}</div>
                    <div className="roi-metric-label">Annual Savings</div>
                </div>

                <div className="roi-metric monthly">
                    <div className="roi-metric-icon">🗓️</div>
                    <div className="roi-metric-value">{formatINR(roi.monthly_savings_inr)}</div>
                    <div className="roi-metric-label">Monthly Savings</div>
                </div>

                <div className="roi-metric profit">
                    <div className="roi-metric-icon">🚀</div>
                    <div className="roi-metric-value">
                        {hasSubsidy && roi.lifetime_profit_after_subsidy_inr > 0
                            ? formatINR(roi.lifetime_profit_after_subsidy_inr)
                            : (roi.lifetime_profit_inr > 0 ? formatINR(roi.lifetime_profit_inr) : '—')}
                    </div>
                    <div className="roi-metric-label">
                        {hasSubsidy ? '25yr Profit (w/ Subsidy)' : 'Lifetime Profit'}
                    </div>
                </div>
            </div>

            {/* ── Footer stats ───────────────────────────────────────────────── */}
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>⚡ Annual Energy Output</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {roi.energy_output_kwh_per_year.toLocaleString('en-IN')} kWh/yr
                    </span>
                </div>
                {hasSubsidy && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                        <span style={{ color: 'var(--text-muted)' }}>🏛️ Net Cost After Subsidy</span>
                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                            {formatINR(roi.net_cost_after_subsidy_inr)}
                        </span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                    <span style={{ color: 'var(--text-muted)' }}>🔋 System Lifetime</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {roi.system_lifetime_years} years
                    </span>
                </div>
            </div>

            {/* DCR mandate notice */}
            <div style={{
                marginTop: 10,
                fontSize: 11,
                color: '#475569',
                padding: '7px 10px',
                background: 'rgba(245,158,11,0.05)',
                borderRadius: 6,
                borderLeft: '2px solid rgba(245,158,11,0.3)',
            }}>
                ⚠️ <strong style={{ color: '#94a3b8' }}>DCR Mandate (June 2026):</strong> Subsidy requires ALMM List-II certified (Made-in-India) modules & cells.
            </div>
        </div>
    );
}
