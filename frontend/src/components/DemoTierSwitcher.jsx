import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';
const DEMO_KEY = 'helioscope-demo-2026';

const TIERS = [
    { id: 'free', label: '🌱 Free', color: '#10b981', desc: '3 analyses/month' },
    { id: 'pro', label: '⚡ Pro', color: '#f59e0b', desc: '50 analyses + Dashboard + AI' },
    { id: 'enterprise', label: '🚀 Enterprise', color: '#6366f1', desc: 'Unlimited + Export' },
];

export default function DemoTierSwitcher() {
    const { token, updateToken } = useAuth();
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const [open, setOpen] = useState(false);

    const switchTier = async (tier) => {
        if (!token) { setMsg('⚠️ Login first'); setOpen(true); return; }
        setBusy(true); setMsg('');
        try {
            const resp = await fetch(`${API_BASE}/api/auth/demo-tier`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ tier, demo_key: DEMO_KEY }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Failed');
            // Update auth context with new token + user (fresh JWT with new tier claim)
            updateToken(data.access_token, data.user);
            setMsg(`✅ Now on ${data.user.tier} tier`);
            setTimeout(() => setOpen(false), 1200);
        } catch (e) {
            setMsg(`❌ ${e.message}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            {/* Floating demo pill */}
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    background: 'rgba(99,102,241,0.15)',
                    border: '1px solid rgba(99,102,241,0.4)',
                    borderRadius: 20, padding: '5px 12px',
                    color: '#818cf8', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.2s',
                }}
            >
                🎪 Demo
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: 36, right: 0, zIndex: 9999,
                    background: '#0f172a', border: '1px solid rgba(99,102,241,0.4)',
                    borderRadius: 12, padding: 14, minWidth: 200,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Quick Tier Switch
                    </div>
                    {TIERS.map(t => (
                        <button key={t.id} onClick={() => switchTier(t.id)} disabled={busy}
                            style={{
                                display: 'block', width: '100%', marginBottom: 6,
                                padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                                background: 'rgba(255,255,255,0.04)',
                                border: `1px solid rgba(255,255,255,0.08)`,
                                textAlign: 'left', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = t.color}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                        >
                            <div style={{ color: t.color, fontWeight: 700, fontSize: 13 }}>{t.label}</div>
                            <div style={{ color: '#475569', fontSize: 11 }}>{t.desc}</div>
                        </button>
                    ))}
                    {msg && (
                        <div style={{ fontSize: 11, color: msg.startsWith('✅') ? '#10b981' : '#ef4444', marginTop: 8, textAlign: 'center' }}>
                            {msg}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
