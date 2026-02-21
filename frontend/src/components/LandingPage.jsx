import { useEffect, useRef, useState } from 'react';

/* ─── Inline styles (no CSS file needed) ──────────────────────────── */
const S = {
    page: {
        minHeight: '100vh', background: '#020b14',
        fontFamily: "'Inter', 'Outfit', sans-serif",
        color: '#f1f5f9', overflowX: 'hidden',
        scrollBehavior: 'smooth',
    },
};

/* ─── Particle Canvas ──────────────────────────────────────────────── */
function ParticleCanvas() {
    const ref = useRef(null);
    useEffect(() => {
        const c = ref.current;
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth;
        let h = c.height = window.innerHeight;
        const resize = () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; };
        window.addEventListener('resize', resize);

        const N = 90;
        const pts = Array.from({ length: N }, () => ({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
            r: Math.random() * 2 + 0.5,
            hue: Math.random() < 0.6 ? 142 : 38, // green or amber
        }));

        let af;
        const draw = () => {
            ctx.clearRect(0, 0, w, h);
            pts.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0 || p.x > w) p.vx *= -1;
                if (p.y < 0 || p.y > h) p.vy *= -1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${p.hue},80%,60%,0.7)`;
                ctx.fill();
            });
            // draw connecting lines
            for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
                const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(pts[i].x, pts[i].y);
                    ctx.lineTo(pts[j].x, pts[j].y);
                    ctx.strokeStyle = `rgba(16,185,129,${0.15 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.6;
                    ctx.stroke();
                }
            }
            af = requestAnimationFrame(draw);
        };
        draw();
        return () => { cancelAnimationFrame(af); window.removeEventListener('resize', resize); };
    }, []);
    return (
        <canvas ref={ref} style={{
            position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        }} />
    );
}

/* ─── 3D rotating solar globe ──────────────────────────────────────── */
function SolarGlobe() {
    return (
        <div style={{ position: 'relative', width: 340, height: 340, margin: '0 auto' }}>
            <style>{`
        @keyframes rotateGlobe { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
        @keyframes orbit1 { from { transform: rotateZ(0deg) translateX(160px); } to { transform: rotateZ(360deg) translateX(160px); } }
        @keyframes orbit2 { from { transform: rotateZ(120deg) translateX(130px); } to { transform: rotateZ(480deg) translateX(130px); } }
        @keyframes orbit3 { from { transform: rotateZ(240deg) translateX(100px); } to { transform: rotateZ(600deg) translateX(100px); } }
        @keyframes pulse { 0%,100%{opacity:0.6;transform:scale(1);} 50%{opacity:1;transform:scale(1.08);} }
        @keyframes panelSpin { 0%{transform:rotateY(0deg) rotateX(10deg);} 100%{transform:rotateY(360deg) rotateX(10deg);} }
        @keyframes energyFlow { 0%{stroke-dashoffset:1000;} 100%{stroke-dashoffset:0;} }
        @keyframes floatUp { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-18px);} }
        @keyframes shimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
        @keyframes sunRay { 0%,100%{transform:rotate(var(--r)) scaleX(0.7);opacity:0.3;} 50%{transform:rotate(var(--r)) scaleX(1.2);opacity:0.8;} }
        @keyframes countUp { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }
        @keyframes slideIn { from{opacity:0;transform:translateX(-40px);} to{opacity:1;transform:translateX(0);} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(40px);} to{opacity:1;transform:translateY(0);} }
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        .fade-up { animation: fadeUp 0.7s ease both; }
        .slide-in { animation: slideIn 0.6s ease both; }
      `}</style>

            {/* Globe core */}
            <div style={{
                position: 'absolute', inset: '40px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #1a4731, #0d2818, #020b14)',
                boxShadow: '0 0 60px rgba(16,185,129,0.35), 0 0 120px rgba(16,185,129,0.12), inset 0 0 40px rgba(16,185,129,0.1)',
                animation: 'pulse 3s ease-in-out infinite',
            }}>
                {/* Grid lines on globe */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3 }} viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="98" fill="none" stroke="#10b981" strokeWidth="0.5" />
                    <ellipse cx="100" cy="100" rx="98" ry="30" fill="none" stroke="#10b981" strokeWidth="0.4" />
                    <ellipse cx="100" cy="100" rx="98" ry="60" fill="none" stroke="#10b981" strokeWidth="0.4" />
                    <line x1="100" y1="2" x2="100" y2="198" stroke="#10b981" strokeWidth="0.4" />
                    <line x1="2" y1="100" x2="198" y2="100" stroke="#10b981" strokeWidth="0.4" />
                </svg>
            </div>

            {/* Sun (centre) */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%',
                width: 60, height: 60, marginLeft: -30, marginTop: -30,
                borderRadius: '50%',
                background: 'radial-gradient(circle, #fef08a, #f59e0b, #d97706)',
                boxShadow: '0 0 30px #f59e0b, 0 0 60px rgba(245,158,11,0.5)',
                animation: 'pulse 2s ease-in-out infinite',
                zIndex: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
            }}>☀️</div>

            {/* Orbiting solar panels */}
            {[
                { anim: 'orbit1 6s linear infinite', size: 28, emoji: '🔆' },
                { anim: 'orbit2 8s linear infinite', size: 22, emoji: '⚡' },
                { anim: 'orbit3 10s linear infinite', size: 18, emoji: '🌿' },
            ].map((o, i) => (
                <div key={i} style={{
                    position: 'absolute', top: '50%', left: '50%',
                    marginLeft: -o.size / 2, marginTop: -o.size / 2,
                    width: o.size, height: o.size,
                    borderRadius: '50%',
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: o.size * 0.55,
                    animation: o.anim,
                    zIndex: 5,
                }}>{o.emoji}</div>
            ))}

            {/* Orbit rings */}
            {[160, 130, 100].map((r, i) => (
                <div key={i} style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: r * 2, height: r * 2,
                    marginLeft: -r, marginTop: -r,
                    borderRadius: '50%',
                    border: `1px solid rgba(16,185,129,${0.12 + i * 0.06})`,
                    pointerEvents: 'none',
                }} />
            ))}
        </div>
    );
}

/* ─── 3D Solar Panel Card ──────────────────────────────────────────── */
function SolarPanelCard({ delay = '0s' }) {
    return (
        <div style={{
            width: 90, height: 60,
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2040 50%, #1a3060 100%)',
            border: '1px solid rgba(59,130,246,0.4)',
            borderRadius: 6,
            position: 'relative',
            boxShadow: '0 4px 20px rgba(59,130,246,0.2)',
            animation: `floatUp 3s ease-in-out ${delay} infinite`,
            overflow: 'hidden',
        }}>
            {/* Grid lines */}
            {[0, 1, 2].map(r => (
                <div key={r} style={{
                    position: 'absolute', left: 0, right: 0,
                    top: `${(r + 1) * 25}%`, height: '1px',
                    background: 'rgba(59,130,246,0.3)',
                }} />
            ))}
            {[0, 1, 2, 3].map(c => (
                <div key={c} style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${(c + 1) * 20}%`, width: '1px',
                    background: 'rgba(59,130,246,0.3)',
                }} />
            ))}
            {/* Shimmer */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)',
                backgroundSize: '200% 100%',
                animation: `shimmer 2s linear ${delay} infinite`,
            }} />
        </div>
    );
}

/* ─── Stat Counter ─────────────────────────────────────────────────── */
function StatCounter({ value, label, icon, delay = '0s' }) {
    return (
        <div style={{
            textAlign: 'center', padding: '20px 24px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(16,185,129,0.15)',
            borderRadius: 16,
            animation: `countUp 0.6s ease ${delay} both`,
        }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>
            <div style={{
                fontSize: 32, fontWeight: 900, color: '#10b981',
                fontFamily: "'Space Grotesk', sans-serif",
            }}>{value}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
        </div>
    );
}

/* ─── Feature Card ─────────────────────────────────────────────────── */
function FeatureCard({ icon, title, desc, gradient, delay = '0s' }) {
    const [hov, setHov] = useState(false);
    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                padding: '28px 24px',
                background: hov ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${hov ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 16,
                transition: 'all 0.25s',
                cursor: 'default',
                animation: `fadeUp 0.6s ease ${delay} both`,
                transform: hov ? 'translateY(-4px)' : 'none',
            }}
        >
            <div style={{
                width: 48, height: 48, borderRadius: 12, marginBottom: 16,
                background: gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, boxShadow: hov ? '0 8px 24px rgba(16,185,129,0.3)' : 'none',
                transition: 'box-shadow 0.25s',
            }}>{icon}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: '#f1f5f9' }}>{title}</div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{desc}</div>
        </div>
    );
}

/* ─── Pricing Card ─────────────────────────────────────────────────── */
function PricingCard({ tier, price, features, color, popular = false, delay = '0s' }) {
    return (
        <div style={{
            padding: '32px 24px',
            background: popular ? `rgba(${color},0.08)` : 'rgba(255,255,255,0.03)',
            border: `${popular ? 2 : 1}px solid rgba(${color},${popular ? 0.5 : 0.15})`,
            borderRadius: 20, position: 'relative',
            animation: `fadeUp 0.6s ease ${delay} both`,
        }}>
            {popular && (
                <div style={{
                    position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                    background: `rgb(${color})`, color: '#000',
                    padding: '4px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                }}>⭐ Most Popular</div>
            )}
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: '#f1f5f9' }}>{tier}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: `rgb(${color})`, fontFamily: "'Space Grotesk', sans-serif" }}>
                {price}<span style={{ fontSize: 14, color: '#64748b', fontWeight: 400 }}>/mo</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {features.map((f, i) => (
                    <li key={i} style={{ fontSize: 13, color: '#94a3b8', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: `rgb(${color})`, flexShrink: 0 }}>✓</span>{f}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────────── */
export default function LandingPage({ onEnter }) {
    const [typed, setTyped] = useState('');
    const phrases = ['Rooftops.', 'Farmlands.', 'Solar Parks.', 'Your Future.'];
    const [pIdx, setPIdx] = useState(0);

    // Typewriter effect
    useEffect(() => {
        const phrase = phrases[pIdx];
        let i = 0;
        setTyped('');
        const iv = setInterval(() => {
            setTyped(phrase.slice(0, ++i));
            if (i >= phrase.length) {
                clearInterval(iv);
                setTimeout(() => setPIdx(p => (p + 1) % phrases.length), 1800);
            }
        }, 70);
        return () => clearInterval(iv);
    }, [pIdx]); // eslint-disable-line

    const features = [
        { icon: '🛰️', title: 'Real NASA Data', desc: 'Live satellite solar irradiance from NASA POWER API — 365-day verified actuals, not static maps.', gradient: 'linear-gradient(135deg,#1e3a5f,#0f2040)', delay: '0.1s' },
        { icon: '🧮', title: '8-Factor Algorithm', desc: 'Gaussian-sigmoid scoring for solar, slope, wind, cloud cover, grid proximity, and more.', gradient: 'linear-gradient(135deg,#1a3020,#0d2010)', delay: '0.2s' },
        { icon: '🤖', title: 'AI Reports', desc: 'Human-readable site intelligence powered by Google Gemini 2.0 Flash — not just a number.', gradient: 'linear-gradient(135deg,#2d1b69,#1a0f40)', delay: '0.3s' },
        { icon: '📐', title: 'Terrain Slope', desc: '5-point stencil slope estimation — know if your terrain is IEC-compliant before spending a rupee.', gradient: 'linear-gradient(135deg,#3b1a1a,#1a0d0d)', delay: '0.4s' },
        { icon: '🏭', title: 'Plant-Size Planning', desc: 'Capacity-first ROI: pick 10/20/30/50kW and get land area, cost, and payback instantly.', gradient: 'linear-gradient(135deg,#1a2d1a,#0d1a0d)', delay: '0.5s' },
        { icon: '🇮🇳', title: 'PM Surya Ghar', desc: 'MNRE 2026 subsidy calculator built-in — ₹78,000 CFA included in every financial projection.', gradient: 'linear-gradient(135deg,#2d2040,#1a1230)', delay: '0.6s' },
    ];

    return (
        <div style={S.page}>
            <ParticleCanvas />

            {/* ── HERO ─────────────────────────────────────────────────── */}
            <section style={{
                minHeight: '100vh', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '40px 20px', position: 'relative', zIndex: 1,
                textAlign: 'center',
            }}>
                {/* Logo */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40,
                    animation: 'countUp 0.5s ease both',
                }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: 'linear-gradient(135deg,#10b981,#f59e0b)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24, boxShadow: '0 0 30px rgba(16,185,129,0.4)',
                    }}>⚡</div>
                    <div>
                        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>HelioScope AI</div>
                        <div style={{ fontSize: 11, color: '#64748b', letterSpacing: '2px', textTransform: 'uppercase' }}>Renewable Intelligence</div>
                    </div>
                </div>

                {/* 3D Globe */}
                <div style={{ marginBottom: 50, animation: 'countUp 0.6s ease 0.1s both' }}>
                    <SolarGlobe />
                </div>

                {/* Headline */}
                <h1 style={{
                    fontSize: 'clamp(36px,6vw,72px)',
                    fontWeight: 900, lineHeight: 1.1, marginBottom: 16,
                    letterSpacing: '-2px',
                    animation: 'fadeUp 0.7s ease 0.2s both',
                }}>
                    Solar Intelligence for<br />
                    <span style={{
                        background: 'linear-gradient(90deg,#10b981,#34d399,#f59e0b)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                        {typed}<span style={{ animation: 'pulse 0.8s ease infinite', color: '#10b981' }}>|</span>
                    </span>
                </h1>

                <p style={{
                    fontSize: 'clamp(14px,2vw,20px)', color: '#64748b', maxWidth: 600,
                    lineHeight: 1.7, marginBottom: 40,
                    animation: 'fadeUp 0.7s ease 0.3s both',
                }}>
                    Find the perfect solar site in 30 seconds — real NASA data, 8-factor AI scoring,
                    PM Surya Ghar subsidy forecasts, and Gemini-powered site reports.
                </p>

                {/* CTA Buttons */}
                <div style={{
                    display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center',
                    animation: 'fadeUp 0.7s ease 0.4s both',
                }}>
                    <button onClick={onEnter} style={{
                        padding: '16px 40px', borderRadius: 50,
                        background: 'linear-gradient(90deg,#10b981,#059669)',
                        border: 'none', color: '#fff', fontWeight: 800, fontSize: 16,
                        cursor: 'pointer', letterSpacing: '0.3px',
                        boxShadow: '0 0 30px rgba(16,185,129,0.4)',
                        transition: 'all 0.2s',
                    }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        🚀 Launch App — Free
                    </button>
                    <button onClick={onEnter} style={{
                        padding: '16px 32px', borderRadius: 50,
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#f1f5f9', fontWeight: 600, fontSize: 15,
                        cursor: 'pointer', transition: 'all 0.2s',
                    }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)'; e.currentTarget.style.color = '#10b981'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#f1f5f9'; }}
                    >
                        🗺️ View Live Demo
                    </button>
                </div>

                {/* Scroll indicator */}
                <div style={{
                    position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    color: '#475569', fontSize: 12,
                    animation: 'floatUp 2s ease-in-out infinite',
                }}>
                    <div>Scroll to explore</div>
                    <div style={{ fontSize: 18 }}>↓</div>
                </div>
            </section>

            {/* ── SOLAR PANELS DISPLAY ─────────────────────────────────── */}
            <section style={{
                padding: '60px 20px', position: 'relative', zIndex: 1,
                display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap',
                background: 'linear-gradient(180deg, transparent, rgba(16,185,129,0.03), transparent)',
            }}>
                {['0s', '0.5s', '1s', '1.5s', '0.8s'].map((d, i) => (
                    <SolarPanelCard key={i} delay={d} />
                ))}
            </section>

            {/* ── STATS ───────────────────────────────────────────────── */}
            <section style={{ padding: '60px 5%', position: 'relative', zIndex: 1 }}>
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16,
                    maxWidth: 900, margin: '0 auto',
                }}>
                    <StatCounter value="8" label="Scoring Factors" icon="🧮" delay="0.1s" />
                    <StatCounter value="96%" label="Avg Confidence" icon="🎯" delay="0.2s" />
                    <StatCounter value="30s" label="Full Analysis" icon="⚡" delay="0.3s" />
                    <StatCounter value="500GW" label="India 2030 Goal" icon="🇮🇳" delay="0.4s" />
                    <StatCounter value="₹78k" label="Max Subsidy" icon="💰" delay="0.5s" />
                </div>
            </section>

            {/* ── FEATURES ────────────────────────────────────────────── */}
            <section style={{ padding: '80px 5%', position: 'relative', zIndex: 1 }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <div style={{ fontSize: 12, color: '#10b981', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: 12 }}>
                        Why HelioScope AI
                    </div>
                    <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.2 }}>
                        Production-grade intelligence,<br />
                        <span style={{ background: 'linear-gradient(90deg,#10b981,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            consumer-grade simplicity
                        </span>
                    </h2>
                </div>
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
                    gap: 20, maxWidth: 1100, margin: '0 auto',
                }}>
                    {features.map((f, i) => <FeatureCard key={i} {...f} />)}
                </div>
            </section>

            {/* ── HOW IT WORKS ────────────────────────────────────────── */}
            <section style={{
                padding: '80px 5%', position: 'relative', zIndex: 1,
                background: 'rgba(16,185,129,0.03)',
                borderTop: '1px solid rgba(16,185,129,0.08)',
                borderBottom: '1px solid rgba(16,185,129,0.08)',
            }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-1px' }}>
                        How it works
                    </h2>
                </div>
                <div style={{
                    display: 'flex', gap: 0, flexWrap: 'wrap', justifyContent: 'center',
                    maxWidth: 900, margin: '0 auto',
                }}>
                    {[
                        { n: '01', icon: '📍', title: 'Pick a Location', desc: 'Click anywhere on the satellite map, or draw your rooftop polygon for precise area.' },
                        { n: '02', icon: '🏭', title: 'Set Plant Size', desc: 'Choose 10/20/30/50kW or custom. We calculate land area and cost instantly.' },
                        { n: '03', icon: '⚡', title: 'Analyze', desc: 'Concurrent fetch from NASA, Open-Meteo, and Elevation APIs. Score in <30 seconds.' },
                        { n: '04', icon: '📊', title: 'Get Intelligence', desc: 'Full 8-factor breakdown, ROI projection with PM Surya Ghar subsidy, and AI report.' },
                    ].map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '20px 24px', flex: '1 1 200px', animation: `fadeUp 0.6s ease ${i * 0.1}s both` }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: 50, flexShrink: 0,
                                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 900, color: '#10b981', fontSize: 13,
                            }}>{step.n}</div>
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: 6, color: '#f1f5f9' }}>{step.icon} {step.title}</div>
                                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{step.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── PRICING ─────────────────────────────────────────────── */}
            <section style={{ padding: '80px 5%', position: 'relative', zIndex: 1 }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-1px' }}>
                        Simple, transparent pricing
                    </h2>
                    <p style={{ color: '#64748b', marginTop: 12, fontSize: 15 }}>Start free. Scale when you're ready.</p>
                </div>
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
                    gap: 20, maxWidth: 860, margin: '0 auto 40px',
                }}>
                    <PricingCard
                        tier="🌱 Free"
                        price="₹0"
                        color="16,185,129"
                        delay="0.1s"
                        features={['3 analyses/month', 'Basic placement score', '8-factor breakdown', 'ROI projection']}
                    />
                    <PricingCard
                        tier="⚡ Pro"
                        price="₹499"
                        color="245,158,11"
                        popular={true}
                        delay="0.2s"
                        features={['50 analyses/month', 'Smart Energy Dashboard', 'Gemini AI Reports', 'PM Surya Ghar subsidy', 'Cloud + slope data']}
                    />
                    <PricingCard
                        tier="🚀 Enterprise"
                        price="₹1,999"
                        color="139,92,246"
                        delay="0.3s"
                        features={['Unlimited analyses', 'All Pro features', 'PDF report export', 'API access', 'Priority support']}
                    />
                </div>

                {/* CTA */}
                <div style={{ textAlign: 'center' }}>
                    <button onClick={onEnter} style={{
                        padding: '18px 56px', borderRadius: 50,
                        background: 'linear-gradient(90deg,#10b981,#059669)',
                        border: 'none', color: '#fff', fontWeight: 800, fontSize: 18,
                        cursor: 'pointer',
                        boxShadow: '0 0 40px rgba(16,185,129,0.4)',
                        transition: 'all 0.2s', letterSpacing: '0.3px',
                    }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        🌞 Start Analyzing — Free
                    </button>
                    <div style={{ marginTop: 16, fontSize: 13, color: '#475569' }}>
                        No credit card required · 3 free analyses every month
                    </div>
                </div>
            </section>

            {/* ── FOOTER ──────────────────────────────────────────────── */}
            <footer style={{
                padding: '40px 5%', borderTop: '1px solid rgba(255,255,255,0.06)',
                position: 'relative', zIndex: 1,
                display: 'flex', flexWrap: 'wrap', gap: 20,
                alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>⚡</span>
                    <span style={{ fontWeight: 700 }}>HelioScope AI</span>
                    <span style={{ fontSize: 12, color: '#475569' }}>© 2026</span>
                </div>
                <div style={{ fontSize: 12, color: '#475569' }}>
                    tejasbarguje9@gmail.com · Built for India's solar future ☀️
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#475569' }}>
                    <a href="https://github.com/tejasbargujepatil/HelioScopeAI" target="_blank" rel="noreferrer"
                        style={{ color: '#64748b', textDecoration: 'none' }}>GitHub</a>
                    <span>|</span>
                    <a href="http://localhost:8001/docs" target="_blank" rel="noreferrer"
                        style={{ color: '#64748b', textDecoration: 'none' }}>API Docs</a>
                </div>
            </footer>
        </div>
    );
}
