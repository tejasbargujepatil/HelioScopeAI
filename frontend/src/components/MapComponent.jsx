import { useEffect, useRef, useState, useCallback } from 'react';
import {
    MapContainer, TileLayer, useMapEvents,
    Polygon, Marker, Tooltip, useMap, CircleMarker,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Geodesic area (Shoelace on sphere) ────────────────────────────────────
function geodesicArea(latlngs) {
    if (!latlngs || latlngs.length < 3) return 0;
    const R = 6371000;
    let area = 0;
    const n = latlngs.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const φ1 = (latlngs[i][0] * Math.PI) / 180;
        const φ2 = (latlngs[j][0] * Math.PI) / 180;
        const λ1 = (latlngs[i][1] * Math.PI) / 180;
        const λ2 = (latlngs[j][1] * Math.PI) / 180;
        area += (λ2 - λ1) * (2 + Math.sin(φ1) + Math.sin(φ2));
    }
    return Math.abs((area * R * R) / 2);
}

function formatArea(m2) {
    if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(3)} km²`;
    if (m2 >= 10_000) return `${(m2 / 10_000).toFixed(2)} ha`;
    return `${Math.round(m2).toLocaleString()} m²`;
}

// ── Grade → colour ────────────────────────────────────────────────────────
const gradeColor = (score) => {
    if (!score) return '#6366f1';
    if (score >= 80) return '#10b981';
    if (score >= 65) return '#3b82f6';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
};

// ── Tile layers ───────────────────────────────────────────────────────────
const TILES = {
    dark: {
        label: '🗺️ Map',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '© OpenStreetMap © CARTO',
    },
    satellite: {
        label: '🛰️ Satellite',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '© Esri © DigitalGlobe',
    },
};

// ── Custom SVG pin (clean, no annoying circles) ───────────────────────────
function makePinIcon(score) {
    const color = gradeColor(score);
    const label = score ? `${score}` : '?';
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="54" viewBox="0 0 44 54">
      <defs>
        <filter id="sh" x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.5)"/>
        </filter>
      </defs>
      <!-- pin body -->
      <path d="M22 2C13.16 2 6 9.16 6 18c0 12 16 32 16 32s16-20 16-32C38 9.16 30.84 2 22 2z"
            fill="${color}" filter="url(#sh)" />
      <!-- inner circle -->
      <circle cx="22" cy="18" r="9" fill="rgba(0,0,0,0.35)" />
      <!-- score text -->
      <text x="22" y="23" text-anchor="middle"
            font-family="'Space Grotesk',Inter,sans-serif"
            font-size="${label.length > 2 ? '9' : '11'}" font-weight="700"
            fill="#fff">${label}</text>
    </svg>`;
    return L.divIcon({
        className: '',
        html: svg,
        iconSize: [44, 54],
        iconAnchor: [22, 54],
        popupAnchor: [0, -54],
    });
}

// Neutral "pending" pin (before analysis)
const pendingIcon = L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 1C7.93 1 3 5.93 3 12c0 8 11 22 11 22s11-14 11-22C25 5.93 20.07 1 14 1z"
          fill="#6366f1" opacity="0.85" />
    <circle cx="14" cy="12" r="5" fill="rgba(255,255,255,0.25)" />
  </svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
});

// ── Vertex icons ──────────────────────────────────────────────────────────
const vertexIcon = L.divIcon({
    className: '',
    html: '<div style="width:9px;height:9px;background:#f59e0b;border:2px solid #fff;border-radius:50%;box-shadow:0 0 5px rgba(245,158,11,0.7);"></div>',
    iconAnchor: [4, 4],
});
const firstVertexIcon = L.divIcon({
    className: '',
    html: '<div title="Click to close" style="width:14px;height:14px;background:#10b981;border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(16,185,129,0.9);cursor:crosshair;"></div>',
    iconAnchor: [7, 7],
});

// ── Geocoding Search (Nominatim / OpenStreetMap) ─────────────────────────
function SearchControl({ onSelect }) {
    const map = useMap();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(false);
    const debounce = useRef(null);
    const wrapRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setFocused(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const search = useCallback(async (q) => {
        if (q.length < 2) { setResults([]); return; }
        setLoading(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=1`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const data = await res.json();
            setResults(data);
        } catch { setResults([]); }
        finally { setLoading(false); }
    }, []);

    const handleInput = (e) => {
        const v = e.target.value;
        setQuery(v);
        clearTimeout(debounce.current);
        debounce.current = setTimeout(() => search(v), 350);
    };

    const pick = (r) => {
        const lat = parseFloat(r.lat);
        const lng = parseFloat(r.lon);
        map.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
        onSelect({ lat, lng });
        setQuery(r.display_name.split(',')[0]);
        setResults([]);
        setFocused(false);
    };

    const showDrop = focused && (results.length > 0 || loading);

    return (
        <div
            ref={wrapRef}
            style={{
                position: 'absolute', top: 10, left: 10, zIndex: 1500,
                width: 320, fontFamily: 'Inter, sans-serif',
            }}
            // Prevent map click events from passing through
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
        >
            {/* Input */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(10,22,40,0.95)',
                backdropFilter: 'blur(16px)',
                border: focused ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: showDrop ? '10px 10px 0 0' : 10,
                padding: '9px 12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                transition: 'border-color 0.15s',
            }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>
                    {loading ? '⏳' : '🔍'}
                </span>
                <input
                    value={query}
                    onChange={handleInput}
                    onFocus={() => setFocused(true)}
                    placeholder="Search city, address, area…"
                    style={{
                        flex: 1, background: 'none', border: 'none', outline: 'none',
                        color: '#f1f5f9', fontSize: 13, fontFamily: 'inherit',
                    }}
                />
                {query && (
                    <button
                        onMouseDown={e => { e.preventDefault(); setQuery(''); setResults([]); }}
                        style={{
                            background: 'none', border: 'none', color: '#64748b',
                            cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1,
                        }}
                    >✕</button>
                )}
            </div>

            {/* Dropdown */}
            {showDrop && (
                <div style={{
                    background: 'rgba(10,22,40,0.97)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderTop: 'none',
                    borderRadius: '0 0 10px 10px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                }}>
                    {loading && (
                        <div style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>Searching…</div>
                    )}
                    {results.map((r, i) => {
                        const parts = r.display_name.split(',');
                        const main = parts[0];
                        const sub = parts.slice(1, 3).join(',').trim();
                        return (
                            <div
                                key={r.place_id}
                                onMouseDown={() => pick(r)}
                                style={{
                                    padding: '10px 14px',
                                    cursor: 'pointer',
                                    borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                    transition: 'background 0.12s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{main}</div>
                                {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sub}</div>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── GPS + Layer controls (inside map) ─────────────────────────────────────
function MapControls({ onGPS, tileKey, onTileChange }) {
    const map = useMap();

    const handleGPS = useCallback(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                map.flyTo([coords.latitude, coords.longitude], 15, { animate: true, duration: 1.5 });
                onGPS({ lat: coords.latitude, lng: coords.longitude });
            },
            () => alert('Enable location access in your browser to use GPS.'),
            { enableHighAccuracy: true, timeout: 8000 }
        );
    }, [map, onGPS]);

    const btnBase = {
        background: 'rgba(10,22,40,0.92)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        color: '#f1f5f9',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        padding: '8px 13px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
    };

    return (
        <div style={{
            position: 'absolute', top: 10, right: 10,
            zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 6,
        }}>
            {/* Tile toggle */}
            <div style={{ display: 'flex', gap: 4 }}>
                {Object.entries(TILES).map(([key, t]) => (
                    <button
                        key={key}
                        onClick={() => onTileChange(key)}
                        style={{
                            ...btnBase,
                            background: tileKey === key ? 'rgba(99,102,241,0.85)' : btnBase.background,
                            border: tileKey === key ? '1px solid rgba(99,102,241,0.6)' : btnBase.border,
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            {/* GPS */}
            <button onClick={handleGPS} style={{ ...btnBase, color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}>
                📍 My Location
            </button>
        </div>
    );
}

// ── Drawing layer ─────────────────────────────────────────────────────────
function DrawingLayer({ drawing, vertices, onAdd, onClose }) {
    useMapEvents({
        click(e) {
            if (!drawing) return;
            const { lat, lng } = e.latlng;
            if (vertices.length >= 3) {
                const d = L.latLng(vertices[0]).distanceTo(L.latLng(lat, lng));
                const snap = e.target.getZoom() > 12 ? 30 : e.target.getZoom() > 8 ? 500 : 3000;
                if (d < snap) { onClose(); return; }
            }
            onAdd([lat, lng]);
        },
        dblclick(e) {
            if (!drawing || vertices.length < 3) return;
            L.DomEvent.stopPropagation(e);
            onClose();
        },
    });
    return null;
}

// ── Point click (normal mode) ─────────────────────────────────────────────
function PointPicker({ enabled, onPick }) {
    useMapEvents({ click(e) { if (enabled) onPick({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MapComponent({ onLocationSelect, onAreaDrawn, selectedCoords, score, drawnArea, heatmapData }) {
    const [tileKey, setTileKey] = useState('dark');
    const [drawing, setDrawing] = useState(false);
    const [vertices, setVertices] = useState([]);
    const [polygon, setPolygon] = useState(null);
    const [showHeatmap, setShowHeatmap] = useState(true);

    // Silent GPS on mount
    useEffect(() => {
        navigator.geolocation?.getCurrentPosition(
            ({ coords }) => onLocationSelect({ lat: coords.latitude, lng: coords.longitude }),
            () => { },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const addVertex = useCallback((v) => setVertices(p => [...p, v]), []);

    const closePolygon = useCallback(() => {
        if (vertices.length < 3) return;
        const area = geodesicArea(vertices);
        const centroid = vertices.reduce(
            (a, v) => ({ lat: a.lat + v[0] / vertices.length, lng: a.lng + v[1] / vertices.length }),
            { lat: 0, lng: 0 }
        );
        setPolygon({ vertices, area });
        setDrawing(false);
        onAreaDrawn?.({ area: Math.round(area), vertices: vertices.map(v => [v[0], v[1]]), centroid });
        onLocationSelect(centroid);
    }, [vertices, onAreaDrawn, onLocationSelect]);

    const startDraw = () => { setDrawing(true); setVertices([]); setPolygon(null); onAreaDrawn?.(null); };
    const cancelDraw = () => { setDrawing(false); setVertices([]); };
    const clearPolygon = () => { setPolygon(null); setVertices([]); onAreaDrawn?.(null); };

    const tile = TILES[tileKey];
    const pinIcon = selectedCoords ? makePinIcon(score || null) : null;

    return (
        <div className="map-container" style={{ position: 'relative', cursor: drawing ? 'crosshair' : 'default' }}>
            <MapContainer
                center={[20.5937, 78.9629]}
                zoom={5}
                maxZoom={20}
                style={{ height: '100%', width: '100%' }}
                doubleClickZoom={!drawing}
                scrollWheelZoom={true}
                zoomControl={true}
            >
                <TileLayer key={tileKey} url={tile.url} attribution={tile.attribution} maxZoom={20} />

                <MapControls onGPS={onLocationSelect} tileKey={tileKey} onTileChange={setTileKey} />
                <SearchControl onSelect={onLocationSelect} />

                <PointPicker enabled={!drawing && !polygon} onPick={onLocationSelect} />
                <DrawingLayer drawing={drawing} vertices={vertices} onAdd={addVertex} onClose={closePolygon} />

                {/* Selected pin (clean, no radius circles) */}
                {selectedCoords && !polygon && pinIcon && (
                    <Marker position={[selectedCoords.lat, selectedCoords.lng]} icon={pinIcon}>
                        {score && (
                            <Tooltip permanent direction="right" offset={[6, -28]} opacity={1}>
                                <span style={{ fontSize: 12, fontWeight: 700 }}>Score {score}/100</span>
                            </Tooltip>
                        )}
                    </Marker>
                )}

                {/* In-progress polygon */}
                {drawing && vertices.length >= 2 && (
                    <Polygon
                        positions={vertices}
                        pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.12, weight: 2, dashArray: '7 4' }}
                    />
                )}
                {drawing && vertices.map((v, i) => (
                    <Marker key={i} position={v} icon={i === 0 ? firstVertexIcon : vertexIcon} />
                ))}

                {/* Finished polygon */}
                {polygon && (
                    <Polygon
                        positions={polygon.vertices}
                        pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.15, weight: 2 }}
                    >
                        <Tooltip sticky={false} permanent direction="center" opacity={0.95}>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>📐 {formatArea(polygon.area)}</span>
                        </Tooltip>
                    </Polygon>
                )}
                {/* ── Heatmap overlay ──────────────────────────────────────── */}
                {heatmapData && showHeatmap && heatmapData.cells?.map((cell, i) => (
                    <CircleMarker
                        key={i}
                        center={[cell.lat, cell.lng]}
                        radius={cell === heatmapData.optimal_cell ? 10 : 7}
                        pathOptions={{
                            color: cell === heatmapData.optimal_cell ? '#fbbf24' : cell.color,
                            fillColor: cell.color,
                            fillOpacity: 0.65,
                            weight: cell === heatmapData.optimal_cell ? 2.5 : 1,
                        }}
                    >
                        <Tooltip sticky>
                            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                                <strong>{cell.score}/100 {cell.grade}</strong> — {cell.suitability_class}<br />
                                Slope: {cell.slope_degrees}° · Elev: {cell.elevation}m<br />
                                {cell === heatmapData.optimal_cell && <span style={{ color: '#f59e0b' }}>⭐ Optimal Placement Zone</span>}
                            </div>
                        </Tooltip>
                    </CircleMarker>
                ))}

                {polygon && selectedCoords && pinIcon && (
                    <Marker position={[selectedCoords.lat, selectedCoords.lng]} icon={pinIcon} />
                )}
            </MapContainer>

            {/* ── Bottom toolbar ──────────────────────────────────────────── */}
            <div style={{
                position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                zIndex: 1000, display: 'flex', gap: 8, alignItems: 'center',
            }}>
                {!drawing && !polygon && (
                    <>
                        <div className="map-hint">🗺️ Click to <span>select a location</span></div>
                        <MapBtn color="#f59e0b" border="rgba(245,158,11,0.35)" onClick={startDraw}>
                            ✏️ Draw Area
                        </MapBtn>
                    </>
                )}

                {drawing && (
                    <>
                        <div className="map-hint" style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.35)' }}>
                            {vertices.length < 3
                                ? `✏️ Add ${3 - vertices.length} more point${vertices.length === 2 ? '' : 's'}...`
                                : '👆 Click green dot · double-click · or ✓ Finish'}
                        </div>
                        {vertices.length >= 3 && (
                            <MapBtn color="#10b981" onClick={closePolygon}>✓ Finish</MapBtn>
                        )}
                        <MapBtn color="#ef4444" border="rgba(239,68,68,0.3)" onClick={cancelDraw}>✕ Cancel</MapBtn>
                    </>
                )}

                {polygon && (
                    <>
                        <div className="map-hint" style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.35)' }}>
                            📐 <strong>{formatArea(polygon.area)}</strong> &nbsp;·&nbsp; auto-set as panel area
                        </div>
                        {heatmapData && (
                            <MapBtn
                                color={showHeatmap ? '#10b981' : '#64748b'}
                                border={showHeatmap ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}
                                onClick={() => setShowHeatmap(h => !h)}
                            >
                                {showHeatmap ? '🌡️ Hide Heatmap' : '🌡️ Show Heatmap'}
                            </MapBtn>
                        )}
                        <MapBtn color="#f59e0b" border="rgba(245,158,11,0.35)" onClick={startDraw}>✏️ Redraw</MapBtn>
                        <MapBtn color="rgba(255,255,255,0.5)" border="rgba(255,255,255,0.1)" onClick={clearPolygon}>✕ Clear</MapBtn>
                    </>
                )}
            </div>
        </div>
    );
}

// ── Tiny button helper ────────────────────────────────────────────────────
function MapBtn({ children, onClick, color = '#f1f5f9', border = 'rgba(255,255,255,0.12)' }) {
    return (
        <button
            onClick={onClick}
            style={{
                background: 'rgba(10,22,40,0.92)',
                backdropFilter: 'blur(14px)',
                border: `1px solid ${border}`,
                borderRadius: 100,
                color,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                padding: '9px 18px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                transition: 'all 0.15s',
            }}
        >
            {children}
        </button>
    );
}
