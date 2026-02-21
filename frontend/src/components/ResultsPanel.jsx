import { useEffect, useRef } from 'react';

const getScoreColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 65) return '#3b82f6';
    if (score >= 50) return '#f59e0b';
    if (score >= 35) return '#f97316';
    return '#ef4444';
};

const getGradeClass = (grade) => {
    const map = { 'A+': 'grade-a-plus', 'A': 'grade-a', 'B+': 'grade-b-plus', 'B': 'grade-b', 'C': 'grade-c', 'D': 'grade-d' };
    return map[grade] || 'grade-c';
};

const getRecClass = (score) => {
    if (score >= 80) return 'rec-excellent';
    if (score >= 65) return 'rec-good';
    if (score >= 50) return 'rec-moderate';
    return 'rec-poor';
};

const getSuitabilityStyle = (cls) => {
    const map = {
        'Excellent': { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.5)', color: '#10b981', icon: '🌟' },
        'Good': { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.5)', color: '#3b82f6', icon: '✅' },
        'Moderate': { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.5)', color: '#f59e0b', icon: '⚡' },
        'Poor': { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.5)', color: '#f97316', icon: '⚠️' },
        'Unsuitable': { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.5)', color: '#ef4444', icon: '❌' },
    };
    return map[cls] || map['Moderate'];
};

function ScoreGauge({ score, grade, confidence, suitability_class }) {
    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (score / 100) * circumference;
    const color = getScoreColor(score);
    const sStyle = getSuitabilityStyle(suitability_class);

    return (
        <div className="score-gauge-container">
            <div className="score-ring">
                <svg viewBox="0 0 120 120">
                    <circle className="score-ring-track" cx="60" cy="60" r="54" />
                    <circle
                        className="score-ring-fill"
                        cx="60" cy="60" r="54"
                        stroke={color}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                    />
                </svg>
                <div className="score-ring-text">
                    <span className="score-number" style={{ color }}>{score}</span>
                    <span className="score-label">/ 100</span>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                <span className={`score-grade ${getGradeClass(grade)}`}>Grade {grade}</span>

                {/* Suitability class badge */}
                {suitability_class && (
                    <span style={{
                        fontSize: 12, fontWeight: 700, padding: '3px 10px',
                        borderRadius: 20,
                        background: sStyle.bg,
                        border: `1px solid ${sStyle.border}`,
                        color: sStyle.color,
                    }}>
                        {sStyle.icon} {suitability_class}
                    </span>
                )}

                {/* Confidence badge */}
                {confidence != null && (
                    <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#94a3b8',
                    }}>
                        🎯 Confidence: <strong style={{ color: '#f1f5f9' }}>{confidence}%</strong>
                    </span>
                )}
            </div>
        </div>
    );
}

function MetricBar({ label, value, displayValue, color, icon }) {
    return (
        <div className="metric-bar-item">
            <div className="metric-bar-header">
                <span className="metric-bar-label">{icon} {label}</span>
                <span className="metric-bar-value">{displayValue}</span>
            </div>
            <div className="metric-bar-track">
                <div
                    className="metric-bar-fill"
                    style={{ width: `${Math.min(value || 0, 100)}%`, background: color }}
                />
            </div>
        </div>
    );
}

export default function ResultsPanel({ results, loading }) {
    if (loading) {
        return (
            <div className="card fade-in">
                <div className="card-header">
                    <div className="card-icon solar">📊</div>
                    <div className="card-title">Placement Analysis</div>
                </div>
                <div className="loading-dots">
                    <div className="loading-dot" />
                    <div className="loading-dot" />
                    <div className="loading-dot" />
                </div>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Running 8-factor analysis...
                </p>
            </div>
        );
    }

    if (!results) {
        return (
            <div className="card">
                <div className="card-header">
                    <div className="card-icon solar">📊</div>
                    <div className="card-title">Placement Score</div>
                </div>
                <div className="empty-state">
                    <div className="empty-icon">🌍</div>
                    <div className="empty-title">No Analysis Yet</div>
                    <div className="empty-desc">Select a location on the map and click Analyze</div>
                </div>
            </div>
        );
    }

    const FACTORS = [
        { label: 'Solar Irradiance', value: results.solar_score, display: `${results.solar_irradiance?.toFixed(2)} kWh/m²/d`, icon: '☀️', color: 'linear-gradient(90deg,#f59e0b,#ef4444)' },
        { label: 'Temperature', value: results.temperature_score, display: `${results.temperature_c?.toFixed(1)}°C`, icon: '🌡️', color: 'linear-gradient(90deg,#10b981,#3b82f6)' },
        { label: 'Elevation', value: results.elevation_score, display: `${results.elevation?.toFixed(0)} m`, icon: '⛰️', color: 'linear-gradient(90deg,#3b82f6,#8b5cf6)' },
        { label: 'Wind Speed', value: results.wind_score, display: `${results.wind_speed?.toFixed(1)} m/s`, icon: '💨', color: 'linear-gradient(90deg,#8b5cf6,#3b82f6)' },
        { label: 'Cloud Cover', value: results.cloud_score, display: `${results.cloud_cover_pct?.toFixed(0)}%`, icon: '☁️', color: 'linear-gradient(90deg,#64748b,#94a3b8)' },
        { label: 'Terrain Slope', value: results.slope_score, display: `${results.slope_degrees?.toFixed(1)}°`, icon: '📐', color: 'linear-gradient(90deg,#f97316,#f59e0b)' },
        { label: 'Grid Proximity', value: results.grid_score, display: results.grid_score != null ? `${results.grid_score.toFixed(0)}%` : '—', icon: '⚡', color: 'linear-gradient(90deg,#06b6d4,#3b82f6)' },
        { label: 'Plant Feasibility', value: results.plant_size_score, display: results.plant_size_score != null ? `${results.plant_size_score.toFixed(0)}%` : '—', icon: '🏭', color: 'linear-gradient(90deg,#10b981,#06b6d4)' },
    ];

    return (
        <div className="card fade-in">
            <div className="card-header">
                <div className="card-icon solar">📊</div>
                <div style={{ flex: 1 }}>
                    <div className="card-title">Placement Score</div>
                    {results.algorithm_version && (
                        <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
                            Algorithm {results.algorithm_version}
                        </div>
                    )}
                </div>
            </div>

            <ScoreGauge
                score={results.score}
                grade={results.grade}
                confidence={results.confidence}
                suitability_class={results.suitability_class}
            />

            {/* Constraint violations */}
            {results.constraint_violations?.length > 0 && (
                <div style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 8, padding: '10px 12px', marginBottom: 12,
                }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>
                        ⚠️ Constraint Violations
                    </div>
                    {results.constraint_violations.map((v, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#fca5a5', lineHeight: 1.5 }}>• {v}</div>
                    ))}
                </div>
            )}

            {/* 8-factor sub-scores */}
            <div style={{ marginBottom: 4, fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Factor Breakdown
            </div>
            <div className="metric-bars">
                {FACTORS.map(f => (
                    <MetricBar
                        key={f.label}
                        label={f.label}
                        value={f.value}
                        displayValue={f.display}
                        color={f.color}
                        icon={f.icon}
                    />
                ))}
            </div>

            {/* Calibration note */}
            {results.calibration_adjustment != null && results.calibration_adjustment !== 0 && (
                <div style={{ fontSize: 10, color: '#475569', textAlign: 'right', marginTop: 4 }}>
                    Regional calibration: {results.calibration_adjustment > 0 ? '+' : ''}{results.calibration_adjustment}pts
                </div>
            )}

            <div className={`recommendation-badge ${getRecClass(results.score)}`}>
                {results.recommendation}
            </div>
        </div>
    );
}
