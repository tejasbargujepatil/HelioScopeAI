import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/apiService';

const TIERS = [
    {
        id: 'free',
        name: '🆓 Free',
        price: '₹0',
        period: 'forever',
        color: '#64748b',
        features: [
            '3 analyses per month',
            'Map + placement score',
            'Basic ROI (no subsidy)',
            'Community support',
        ],
        locked: ['PM Surya Ghar subsidy calc', 'AI recommendations', 'Energy dashboard', 'Carbon tracker'],
    },
    {
        id: 'pro',
        name: '⚡ Pro',
        price: '₹499',
        period: '/month',
        color: '#f59e0b',
        highlight: true,
        features: [
            'Unlimited analyses',
            'PM Surya Ghar subsidy auto-calc',
            'AI-powered recommendations',
            'Real-Time Energy Dashboard',
            'AI Energy Prediction (7-day)',
            'Carbon Impact Tracker',
            'Surplus Energy Detection',
            'DCR compliance guidance',
        ],
        locked: ['P2P Marketplace', 'Blockchain Ledger'],
    },
    {
        id: 'enterprise',
        name: '🚀 Enterprise',
        price: '₹1,999',
        period: '/month',
        color: '#6366f1',
        features: [
            'Everything in Pro',
            'P2P Energy Marketplace',
            'Blockchain Transaction Ledger',
            'Dedicated account manager',
            'Custom API access',
            'Priority AI model',
        ],
        locked: [],
    },
];

export default function BillingModal({ onClose, onUpgraded }) {
    const { user, token, updateToken } = useAuth();
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');

    const handleUpgrade = async (tier) => {
        if (tier === 'free') return;
        setBusy(tier); setError('');
        try {
            // Create order
            const { data: order } = await api.post('/api/billing/create-order',
                { tier }, { headers: { Authorization: `Bearer ${token}` } }
            );

            const rzpKey = order.key_id;

            // If real Razorpay key, open checkout
            if (rzpKey && !rzpKey.includes('mock') && window.Razorpay) {
                const options = {
                    key: rzpKey,
                    amount: order.amount,
                    currency: 'INR',
                    name: 'HelioScope AI',
                    description: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Subscription`,
                    order_id: order.order_id,
                    handler: async (response) => {
                        try {
                            const { data: verifyData } = await api.post('/api/billing/verify', {
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                tier,
                            }, { headers: { Authorization: `Bearer ${token}` } });
                            updateToken(verifyData.token, { ...user, tier: verifyData.tier });
                            onUpgraded?.(verifyData.tier);
                            onClose();
                        } catch (e) {
                            setError('Payment verified but upgrade failed. Contact support.');
                        }
                    },
                    prefill: { email: user?.email },
                    theme: { color: '#f59e0b' },
                };
                new window.Razorpay(options).open();
            } else {
                // Mock payment flow (dev mode)
                const { data: verifyData } = await api.post('/api/billing/verify', {
                    razorpay_order_id: order.order_id,
                    razorpay_payment_id: `mock_pay_${Date.now()}`,
                    razorpay_signature: 'mock_signature',
                    tier,
                }, { headers: { Authorization: `Bearer ${token}` } });
                updateToken(verifyData.token, { ...user, tier: verifyData.tier });
                onUpgraded?.(verifyData.tier);
                onClose();
            }
        } catch (err) {
            setError(err?.response?.data?.error || 'Payment failed. Please try again.');
        } finally {
            setBusy('');
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{
                background: 'linear-gradient(145deg, #0f1f38 0%, #0a1628 100%)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
                padding: 32, width: '100%', maxWidth: 900,
                boxShadow: '0 32px 100px rgba(0,0,0,0.7)', maxHeight: '90vh', overflowY: 'auto',
            }}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: 26, fontWeight: 800 }}>
                        Choose Your Plan
                    </h2>
                    <p style={{ margin: '8px 0 0', color: '#64748b' }}>
                        Unlock the full power of HelioScope AI
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#fca5a5', fontSize: 13
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                    {TIERS.map(tier => (
                        <div key={tier.id} style={{
                            background: tier.highlight ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${tier.highlight ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.07)'}`,
                            borderRadius: 14, padding: 24, position: 'relative',
                        }}>
                            {tier.highlight && (
                                <div style={{
                                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                                    background: '#f59e0b', color: '#0a1628', fontSize: 11, fontWeight: 800,
                                    padding: '3px 14px', borderRadius: 20,
                                }}>MOST POPULAR</div>
                            )}

                            <div style={{ fontSize: 16, fontWeight: 800, color: tier.color, marginBottom: 4 }}>{tier.name}</div>
                            <div style={{ marginBottom: 16 }}>
                                <span style={{ fontSize: 30, fontWeight: 900, color: '#f1f5f9' }}>{tier.price}</span>
                                <span style={{ fontSize: 13, color: '#64748b' }}>{tier.period}</span>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                {tier.features.map(f => (
                                    <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                                        <span style={{ color: '#10b981' }}>✓</span>{f}
                                    </div>
                                ))}
                                {tier.locked?.map(f => (
                                    <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#475569', marginBottom: 6 }}>
                                        <span>🔒</span>{f}
                                    </div>
                                ))}
                            </div>

                            {user?.tier === tier.id ? (
                                <div style={{
                                    textAlign: 'center', padding: '10px 0', borderRadius: 8,
                                    background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 700, fontSize: 13,
                                }}>✓ Current Plan</div>
                            ) : tier.id === 'free' ? (
                                <div style={{ textAlign: 'center', color: '#64748b', fontSize: 12, padding: 10 }}>
                                    Default plan on signup
                                </div>
                            ) : (
                                <button
                                    onClick={() => handleUpgrade(tier.id)}
                                    disabled={!!busy}
                                    style={{
                                        width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                                        background: busy === tier.id
                                            ? '#334155'
                                            : tier.highlight
                                                ? 'linear-gradient(90deg,#f59e0b,#d97706)'
                                                : 'rgba(99,102,241,0.8)',
                                        color: '#fff', fontWeight: 800, fontSize: 14,
                                        cursor: busy ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    {busy === tier.id ? '⏳ Processing…' : `Upgrade to ${tier.id === 'pro' ? 'Pro' : 'Enterprise'}`}
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <p style={{ textAlign: 'center', fontSize: 11, color: '#334155', marginTop: 20 }}>
                    Dev mode: Razorpay mock payment active · No real money charged ·{' '}
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                        Close
                    </button>
                </p>
            </div>
        </div>
    );
}
