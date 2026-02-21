import { useState, useEffect } from 'react';

export default function SummaryComponent({ summary, loading }) {
    const [displayed, setDisplayed] = useState('');

    useEffect(() => {
        if (!summary) { setDisplayed(''); return; }
        setDisplayed('');
        let i = 0;
        const text = summary.summary || '';
        const interval = setInterval(() => {
            if (i < text.length) {
                setDisplayed(text.slice(0, i + 1));
                i++;
            } else {
                clearInterval(interval);
            }
        }, 14);
        return () => clearInterval(interval);
    }, [summary]);

    if (loading) {
        return (
            <div className="card fade-in">
                <div className="card-header">
                    <div className="card-icon purple">🤖</div>
                    <div className="card-title">AI Recommendation</div>
                </div>
                <div className="loading-dots">
                    <div className="loading-dot" />
                    <div className="loading-dot" />
                    <div className="loading-dot" />
                </div>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Generating AI insight...
                </p>
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="card">
                <div className="card-header">
                    <div className="card-icon purple">🤖</div>
                    <div className="card-title">AI Recommendation</div>
                </div>
                <div className="empty-state">
                    <div className="empty-icon">💡</div>
                    <div className="empty-title">AI Awaiting Data</div>
                    <div className="empty-desc">Run an analysis to get an AI-powered recommendation</div>
                </div>
            </div>
        );
    }

    return (
        <div className="card fade-in">
            <div className="card-header">
                <div className="card-icon purple">🤖</div>
                <div className="card-title">AI Recommendation</div>
            </div>

            <p className="summary-text">{displayed}</p>

            <div className="summary-badge">
                ⚡ Powered by HelioScope AI
            </div>
        </div>
    );
}
