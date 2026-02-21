import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 8,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
};

export default function AuthModal({ onClose }) {
    const { login, register } = useAuth();
    const [tab, setTab] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true); setError('');
        try {
            if (tab === 'login') {
                await login(email, password);
            } else {
                await register(email, password, name);
            }
            onClose();
        } catch (err) {
            setError(err?.response?.data?.error || err?.response?.data?.detail || 'Something went wrong.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{
                background: 'linear-gradient(145deg, #0f1f38 0%, #0a1628 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16, padding: 32, width: 400, maxWidth: '90vw',
                boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>☀️</div>
                    <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: 22, fontWeight: 800 }}>HelioScope AI</h2>
                    <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
                        {tab === 'login' ? 'Sign in to your account' : 'Create your free account'}
                    </p>
                </div>

                {/* Tab switcher */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 8, marginBottom: 22, padding: 3 }}>
                    {['login', 'register'].map(t => (
                        <button key={t} onClick={() => { setTab(t); setError(''); }}
                            style={{
                                flex: 1, padding: '8px 0', border: 'none', borderRadius: 6, cursor: 'pointer',
                                fontWeight: 700, fontSize: 13,
                                background: tab === t ? 'rgba(245,158,11,0.85)' : 'transparent',
                                color: tab === t ? '#fff' : '#64748b',
                                transition: 'all 0.15s',
                            }}>
                            {t === 'login' ? 'Sign In' : 'Register'}
                        </button>
                    ))}
                </div>

                <form onSubmit={submit}>
                    {tab === 'register' && (
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ fontSize: 12, color: '#64748b', marginBottom: 6, display: 'block' }}>Full Name</label>
                            <input style={inputStyle} placeholder="Ramesh Sharma" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                    )}
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 12, color: '#64748b', marginBottom: 6, display: 'block' }}>Email</label>
                        <input style={inputStyle} type="email" placeholder="you@example.com" value={email}
                            onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ fontSize: 12, color: '#64748b', marginBottom: 6, display: 'block' }}>Password</label>
                        <input style={inputStyle} type="password" placeholder="••••••••" value={password}
                            onChange={e => setPassword(e.target.value)} required minLength={6} />
                    </div>

                    {error && (
                        <div style={{
                            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 8, padding: '9px 12px', marginBottom: 14, fontSize: 13, color: '#fca5a5'
                        }}>
                            {error}
                        </div>
                    )}

                    <button type="submit" disabled={busy} style={{
                        width: '100%', padding: '13px 0', borderRadius: 8, border: 'none',
                        background: busy ? 'rgba(245,158,11,0.4)' : 'linear-gradient(90deg,#f59e0b,#d97706)',
                        color: '#fff', fontWeight: 800, fontSize: 15, cursor: busy ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                    }}>
                        {busy ? '⏳ Please wait…' : (tab === 'login' ? '→ Sign In' : '✨ Create Account')}
                    </button>
                </form>

                {tab === 'register' && (
                    <p style={{ textAlign: 'center', fontSize: 11, color: '#475569', marginTop: 14 }}>
                        Free plan: 3 analyses/month · No credit card required
                    </p>
                )}
            </div>
        </div>
    );
}
