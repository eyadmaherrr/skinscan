/* eslint-disable @next/next/no-img-element -- local object URL / generated data URI, never sent to an image CDN */
'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { Search, Sparkles, Bug } from 'lucide-react';
import { useI18n } from './LocaleProvider';
import { format } from '@/lib/messages';
import {
  HEATMAP_KEYS,
  type HeatmapKey,
  type LesionCandidate,
  type MetricKey,
  type RegionKey,
  type RegionOutline,
  type ScanSuccess,
  type RegionReportV3,
} from '@/lib/skin-analysis/types';

type Layer = 'areas' | 'anatomical' | 'spots' | HeatmapKey | 'none';

const isHeatmapLayer = (layer: Layer): layer is HeatmapKey => (HEATMAP_KEYS as readonly string[]).includes(layer);

interface Props {
  result: ScanSuccess;
  photoUrl: string;
  photoAspect: number;
}

interface Lens {
  id: string;
  title: string;
  detail: string;
  /** Point to magnify, as a fraction of the photo (0–1). */
  fx: number;
  fy: number;
  /** Photo size on screen and pointer position, in CSS pixels. */
  width: number;
  height: number;
  px: number;
  py: number;
}

const ZOOM = 3;
const HOVER_NONE = '(hover: none)';

/** Distinct HSL colors for anatomical regions in diagnostic / V3 mode */
const REGION_PALETTE = [
  'hsl(210, 85%, 60%)',
  'hsl(180, 85%, 55%)',
  'hsl(150, 75%, 55%)',
  'hsl(90, 75%, 50%)',
  'hsl(45, 90%, 55%)',
  'hsl(30, 95%, 60%)',
  'hsl(15, 90%, 60%)',
  'hsl(345, 80%, 65%)',
  'hsl(315, 75%, 65%)',
  'hsl(270, 75%, 65%)',
  'hsl(240, 75%, 65%)',
  'hsl(195, 90%, 50%)',
  'hsl(165, 80%, 45%)',
  'hsl(135, 70%, 45%)',
  'hsl(75, 80%, 45%)',
  'hsl(40, 90%, 48%)',
  'hsl(20, 90%, 52%)',
  'hsl(0, 85%, 58%)',
  'hsl(330, 75%, 55%)',
  'hsl(285, 70%, 55%)',
  'hsl(255, 75%, 60%)',
  'hsl(225, 80%, 60%)',
  'hsl(170, 85%, 45%)',
  'hsl(140, 75%, 45%)',
];

function subscribeHover(onChange: () => void) {
  const query = window.matchMedia(HOVER_NONE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const hoverNone = () => window.matchMedia(HOVER_NONE).matches;
const CARD_WIDTH = 240;
const LENS_SIZE = CARD_WIDTH - 24;
const CARD_HEIGHT = LENS_SIZE + 96;

export default function PhotoOverlay({ result, photoUrl, photoAspect }: Props) {
  const { t, locale } = useI18n();
  const [layer, setLayer] = useState<Layer>('areas');
  const [lens, setLens] = useState<Lens | null>(null);
  // Debug overlay, switched on with ?debug=1 (the results are only ever rendered in the browser).
  const [debugMode, setDebugMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const debug = new URLSearchParams(window.location.search).get('debug');
    return debug === '1' || debug === 'true';
  });
  const [showLandmarkNumbers, setShowLandmarkNumbers] = useState<boolean>(false);
  const touch = useSyncExternalStore(subscribeHover, hoverNone, () => false);
  const frameRef = useRef<HTMLDivElement>(null);

  // A tap outside the photo closes the magnifier on touch screens.
  useEffect(() => {
    if (!lens) return;
    const close = (e: PointerEvent) => {
      if (!frameRef.current?.contains(e.target as Node)) setLens(null);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [lens]);

  const W = 1000;
  const H = W / photoAspect;
  const lesions = result.acne?.status === 'ok' ? result.acne.lesions : [];
  const metricHeatmap = isHeatmapLayer(layer) ? (result.heatmaps?.[layer] ?? null) : null;
  const hasV3Regions = Boolean(result.regionsV3 && Object.keys(result.regionsV3).length > 0);

  const options: { id: Layer; label: string; available: boolean }[] = [
    { id: 'areas', label: t.overlay.areas, available: true },
    { id: 'anatomical', label: locale === 'ar' ? 'المناطق التفصيلية' : 'Detailed zones', available: hasV3Regions },
    { id: 'spots', label: t.overlay.spots, available: lesions.length > 0 },
    ...HEATMAP_KEYS.map((k) => ({ id: k, label: t.overlay.heat[k], available: !!result.heatmaps?.[k] })),
    { id: 'none', label: t.overlay.none, available: true },
  ];

  /** Metrics whose score was highest in each primary region. */
  const metricsByRegion = useMemo(() => {
    const map = new Map<RegionKey, MetricKey[]>();
    for (const [key, metric] of Object.entries(result.analysis) as [MetricKey, ScanSuccess['analysis'][MetricKey]][]) {
      if (metric.score === null) continue;
      for (const region of metric.regions ?? []) map.set(region, [...(map.get(region) ?? []), key]);
    }
    return map;
  }, [result]);

  function place(e: ReactPointerEvent<SVGElement>, id: string, title: string, detail: string, fx?: number, fy?: number) {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    const py = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
    setLens({ id, title, detail, fx: fx ?? px / rect.width, fy: fy ?? py / rect.height, width: rect.width, height: rect.height, px, py });
  }

  function regionDetail(region: RegionKey): string {
    const pores = result.pores?.regionalSummary?.[region];
    const metrics = metricsByRegion.get(region);
    const parts: string[] = [];
    if (metrics?.length) parts.push(format(t.overlay.metricDetail, { list: metrics.map((k) => t.metrics[k]).join(locale === 'ar' ? '، ' : ', ') }));
    if (pores !== undefined) parts.push(format(t.overlay.poreDetail, { n: pores }));
    return parts.length ? parts.join(' · ') : t.overlay.areaDetail;
  }

  function anatomicalDetail(r: RegionReportV3): string {
    const parts: string[] = [];
    parts.push(locale === 'ar' ? `المساحة: ${r.areaMm2} مم²` : `Area: ${r.areaMm2} mm²`);
    parts.push(locale === 'ar' ? `تغطية الجلد: ${Math.round(r.skinCoverage * 100)}%` : `Coverage: ${Math.round(r.skinCoverage * 100)}%`);
    if (r.status !== 'usable') {
      parts.push(locale === 'ar' ? `الحالة: ${r.status}` : `Status: ${r.status}`);
    }
    return parts.join(' · ');
  }

  const onRegion = (r: RegionOutline) => (e: ReactPointerEvent<SVGElement>) =>
    place(e, r.region, t.regions[r.region], regionDetail(r.region));

  const onAnatomicalRegion = (r: RegionReportV3) => (e: ReactPointerEvent<SVGElement>) =>
    place(e, r.key, locale === 'ar' ? r.nameAr : r.nameEn, anatomicalDetail(r));

  const onSpot = (l: LesionCandidate, i: number) => (e: ReactPointerEvent<SVGElement>) =>
    place(e, `spot-${i}`, l.tone === 'red' ? t.overlay.spotRed : t.overlay.spotDark, t.overlay.spotDetail, l.x, l.y);

  // Card position: centred on the pointer, kept inside the photo's width, above the pointer when there is room.
  const cardLeft = lens ? (lens.width <= CARD_WIDTH ? lens.width / 2 : Math.min(Math.max(lens.px, CARD_WIDTH / 2), lens.width - CARD_WIDTH / 2)) : 0;
  const below = lens ? lens.py < CARD_HEIGHT + 16 : false;
  const bgW = lens ? lens.width * ZOOM : 0;
  const bgH = lens ? lens.height * ZOOM : 0;

  // Landmarks & Diagnostic Geometry
  const rawLandmarks = result.landmarks ?? result.v3?.faceGeometry?.landmarks ?? [];
  const bbox = result.v3?.faceGeometry?.boundingBox;
  const geom = result.v3?.faceGeometry;

  // Center of pupil/eye landmarks for alignment axis display
  const leftEyeCenter = rawLandmarks[468] ?? rawLandmarks[33];
  const rightEyeCenter = rawLandmarks[473] ?? rawLandmarks[263];
  const noseTip = rawLandmarks[1] ?? rawLandmarks[4];
  const chin = rawLandmarks[152];

  return (
    <>
      <div className="photoFrameWrapper">
        <div
          ref={frameRef}
          className="photoFrame resultPhoto"
          style={{ aspectRatio: String(photoAspect) }}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setLens(null);
          }}
        >
          <img src={photoUrl} alt={t.overlay.photoAlt} />
          {metricHeatmap ? <img className="heatmapLayer" src={metricHeatmap} alt="" aria-hidden /> : null}

          {/* Primary Regions, V3 Anatomical Regions, or Acne Spots Overlay */}
          {layer === 'areas' || layer === 'anatomical' || layer === 'spots' ? (
            <svg className="regionOverlay" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
              {layer === 'areas' &&
                result.regions.map((r) => (
                  <polygon
                    key={r.region}
                    className={lens?.id === r.region ? 'isHovered' : undefined}
                    points={r.points.map(([x, y]) => `${x * W},${y * H}`).join(' ')}
                    onPointerMove={onRegion(r)}
                    onPointerDown={onRegion(r)}
                  />
                ))}

              {layer === 'anatomical' &&
                result.regionsV3 &&
                Object.values(result.regionsV3).map((r, idx) => {
                  const pts = r.outline ?? r.outlineSource ?? [];
                  const color = REGION_PALETTE[idx % REGION_PALETTE.length];
                  return (
                    <polygon
                      key={r.key}
                      className={`v3Polygon ${lens?.id === r.key ? 'isHovered' : ''}`}
                      points={pts.map(([x, y]) => `${x * W},${y * H}`).join(' ')}
                      style={{
                        fill: lens?.id === r.key ? color.replace(')', ', 0.4)').replace('hsl', 'hsla') : color.replace(')', ', 0.18)').replace('hsl', 'hsla'),
                        stroke: color,
                      }}
                      onPointerMove={onAnatomicalRegion(r)}
                      onPointerDown={onAnatomicalRegion(r)}
                    />
                  );
                })}

              {layer === 'spots' &&
                lesions.map((l, i) => (
                  <circle
                    key={i}
                    className={`${l.tone === 'red' ? 'spotRed' : 'spotDark'}${lens?.id === `spot-${i}` ? ' isHovered' : ''}`}
                    cx={l.x * W}
                    cy={l.y * H}
                    r={Math.max(6, l.r * W * 1.6)}
                    onPointerMove={onSpot(l, i)}
                    onPointerDown={onSpot(l, i)}
                  />
                ))}
            </svg>
          ) : null}

          {/* Development / Diagnostic Overlay */}
          {debugMode && (
            <svg className="diagnosticOverlay" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="Diagnostic Face Alignment Overlay">
              {/* Face Bounding Box */}
              {bbox && (
                <rect
                  className="diagnosticBBox"
                  x={bbox[0] * W}
                  y={bbox[1] * H}
                  width={(bbox[2] - bbox[0]) * W}
                  height={(bbox[3] - bbox[1]) * H}
                />
              )}

              {/* Horizontal Eye Level Axis */}
              {leftEyeCenter && rightEyeCenter && (
                <line
                  className="diagnosticAxis"
                  x1={leftEyeCenter[0] * W - 60}
                  y1={leftEyeCenter[1] * H}
                  x2={rightEyeCenter[0] * W + 60}
                  y2={rightEyeCenter[1] * H}
                />
              )}

              {/* Facial Midline Axis */}
              {noseTip && chin && (
                <line
                  className="diagnosticAxis"
                  x1={noseTip[0] * W}
                  y1={Math.min(noseTip[1], chin[1]) * H - 80}
                  x2={chin[0] * W}
                  y2={chin[1] * H + 40}
                />
              )}

              {/* Region Label Tags */}
              {result.regions.map((r) => {
                const cx = r.points.reduce((acc, p) => acc + p[0], 0) / r.points.length;
                const cy = r.points.reduce((acc, p) => acc + p[1], 0) / r.points.length;
                return (
                  <text key={r.region} className="diagnosticLabel" x={cx * W} y={cy * H} textAnchor="middle">
                    {r.region}
                  </text>
                );
              })}

              {/* All 478 MediaPipe Face Mesh Landmarks */}
              {rawLandmarks.map(([x, y], i) => (
                <g key={i}>
                  <circle
                    className="diagnosticDot"
                    cx={x * W}
                    cy={y * H}
                    r={2.2}
                  >
                    <title>{`LM #${i}: (${Math.round(x * W)}, ${Math.round(y * H)})`}</title>
                  </circle>
                  {showLandmarkNumbers && i % 4 === 0 && (
                    <text
                      x={x * W + 3}
                      y={y * H - 3}
                      fill="#00e5ff"
                      fontSize={7}
                      fontFamily="monospace"
                      paintOrder="stroke"
                      stroke="#000"
                      strokeWidth={1.5}
                    >
                      {i}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          )}
        </div>

        {lens ? (
          <div
            className="zoomPopupCard"
            style={{
              left: `${cardLeft}px`,
              top: `${lens.py}px`,
              transform: below ? 'translate(-50%, 18px)' : 'translate(-50%, calc(-100% - 18px))',
            }}
            aria-live="polite"
          >
            <div className="zoomPopupHeader">
              <div className="zoomPopupTitle">
                <Search size={14} aria-hidden />
                <span>{lens.title}</span>
              </div>
              <span className="zoomBadge">{format(t.overlay.zoom, { n: ZOOM })}</span>
            </div>
            <div className="zoomLensContainer">
              <div
                className="zoomLensImage"
                style={{
                  backgroundImage: `url(${photoUrl})`,
                  backgroundSize: `${bgW}px ${bgH}px`,
                  backgroundPosition: `${LENS_SIZE / 2 - lens.fx * bgW}px ${LENS_SIZE / 2 - lens.fy * bgH}px`,
                  backgroundRepeat: 'no-repeat',
                }}
              />
              <div className="zoomReticle" aria-hidden />
            </div>
            <div className="zoomPopupFooter">
              <span>{lens.detail}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="zoomHint">
        <Sparkles size={13} aria-hidden />
        <span>{touch ? t.overlay.hintTouch : t.overlay.hintHover}</span>
      </div>

      <div className="layerSwitch" role="radiogroup" aria-label={t.overlay.aria}>
        {options
          .filter((o) => o.available)
          .map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={layer === o.id}
              className={layer === o.id ? 'active' : undefined}
              onClick={() => {
                setLayer(o.id);
                setLens(null);
              }}
            >
              {o.label}
            </button>
          ))}
      </div>

      {/* Debug & Diagnostic Mode Toolbar (only in ?debug=1 mode) */}
      {debugMode && (
        <div className="debugToolbar">
          <button
            type="button"
            className={debugMode ? 'active' : undefined}
            onClick={() => setDebugMode(!debugMode)}
            title="Toggle computer vision diagnostic overlay"
          >
            <Bug size={12} style={{ display: 'inline', marginInlineEnd: 4 }} />
            Diagnostics: ON
          </button>

          <button
            type="button"
            className={showLandmarkNumbers ? 'active' : undefined}
            onClick={() => setShowLandmarkNumbers(!showLandmarkNumbers)}
          >
            {showLandmarkNumbers ? 'Hide Point IDs' : 'Show Point IDs'}
          </button>

          {geom && (
            <span className="debugBadge">
              IOD: {geom.iodPx}px · {geom.pxPerMm}px/mm · Pose: Y{geom.yaw}° P{geom.pitch}° R{geom.roll}°
            </span>
          )}
        </div>
      )}

      {layer === 'spots' ? (
        <p className="legend">
          <span className="legendDot red" /> {t.overlay.legendRed} <span className="legendDot dark" /> {t.overlay.legendDark}
        </p>
      ) : null}
      {isHeatmapLayer(layer) ? <p className="legend">{t.overlay.legendHeat[layer]}</p> : null}
    </>
  );
}
