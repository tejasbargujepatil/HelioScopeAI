import { useAuth } from '../context/AuthContext';

/**
 * ProGate — wraps any content that requires a Pro or Enterprise subscription.
 * Shows upgrade prompt if user is on free tier.
 */
export default function ProGate({ children, tier = 'pro', onUpgrade }) {
    const { user } = useAuth();
    const tiers = ['free', 'pro', 'enterprise'];
    const userLevel = tiers.indexOf(user?.tier || 'free');
    const requiredLevel = tiers.indexOf(tier);
    const hasAccess = userLevel >= requiredLevel;

    if (hasAccess) return children;

    const isEnterprise = tier === 'enterprise';
    return (
        <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: isEnterprise
                ? '1px solid rgba(99,102,241,0.3)'
                : '1px solid rgba(245,158,11,0.25)',
            borderRadius: 14, padding: '28px 24px', textAlign: 'center',
        }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>
                {isEnterprise ? '⛓️' : '⚡'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
                {isEnterprise ? 'Enterprise Feature' : 'Pro Feature'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
                {isEnterprise
                    ? 'P2P Energy Trading and Blockchain Ledger require an Enterprise subscription.'
                    : 'This feature is included in the Pro plan. Upgrade to unlock AI dashboards, subsidy calculations, carbon tracking, and more.'}
            </div>
            <button
                onClick={onUpgrade}
                style={{
                    background: isEnterprise
                        ? 'linear-gradient(90deg,#6366f1,#4f46e5)'
                        : 'linear-gradient(90deg,#f59e0b,#d97706)',
                    border: 'none', borderRadius: 8, color: '#fff',
                    fontWeight: 800, fontSize: 13, padding: '10px 24px', cursor: 'pointer',
                }}
            >
                {isEnterprise ? '🚀 Upgrade to Enterprise' : `⚡ Upgrade to Pro — ₹499/mo`}
            </button>
            <div style={{ fontSize: 11, color: '#334155', marginTop: 10 }}>
                Cancel anytime · No contract
            </div>
        </div>
    );
}
