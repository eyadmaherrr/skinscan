/* eslint-disable @next/next/no-img-element -- local object URL / generated data URI, never sent to an image CDN */
'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { useI18n } from './LocaleProvider';
import { format } from '@/lib/messages';
import { HEATMAP_KEYS, type HeatmapKey, type LesionCandidate, type MetricKey, type RegionKey, type RegionOutline, type ScanSuccess } from '@/lib/skin-analysis/types';

type Layer = 'areas' | 'spots' | 'pores' | HeatmapKey | 'none';

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

/** Touch screens (no hover): the hint says "tap" instead of "hover". */
function subscribeHover(onChange: () => void) {
  const query = window.matchMedia(HOVER_NONE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const hoverNone = () => window.matchMedia(HOVER_NONE).matches;
const CARD_WIDTH = 240;
const LENS_SIZE = CARD_WIDTH - 24;
/** Height of the whole card; it opens below the pointer when there is no room above. */
const CARD_HEIGHT = LENS_SIZE + 96;

/**
 * The analysed photo with switchable overlays. Pointing at (or tapping) an
 * analysed area or spot opens a magnifier with what was measured there.
 */
export default function PhotoOverlay({ result, photoUrl, photoAspect }: Props) {
  const { t, locale } = useI18n();
  const [layer, setLayer] = useState<Layer>('areas');
  const [lens, setLens] = useState<Lens | null>(null);
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
  const heatmap = result.pores?.status === 'ok' ? result.pores.heatmap : null;
  // Where each reported characteristic was seen (older results have none).
  const metricHeatmap = isHeatmapLayer(layer) ? (result.heatmaps?.[layer] ?? null) : null;

  const options: { id: Layer; label: string; available: boolean }[] = [
    { id: 'areas', label: t.overlay.areas, available: true },
    { id: 'spots', label: t.overlay.spots, available: lesions.length > 0 },
    { id: 'pores', label: t.overlay.pores, available: !!heatmap },
    ...HEATMAP_KEYS.map((k) => ({ id: k, label: t.overlay.heat[k], available: !!result.heatmaps?.[k] })),
    { id: 'none', label: t.overlay.none, available: true },
  ];

  /** Metrics whose score was highest in each region. */
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

  const onRegion = (r: RegionOutline) => (e: ReactPointerEvent<SVGElement>) =>
    place(e, r.region, t.regions[r.region], regionDetail(r.region));

  const onSpot = (l: LesionCandidate, i: number) => (e: ReactPointerEvent<SVGElement>) =>
    place(e, `spot-${i}`, l.tone === 'red' ? t.overlay.spotRed : t.overlay.spotDark, t.overlay.spotDetail, l.x, l.y);

  // Card position: centred on the pointer, kept inside the photo's width, above the pointer when there is room.
  const cardLeft = lens ? (lens.width <= CARD_WIDTH ? lens.width / 2 : Math.min(Math.max(lens.px, CARD_WIDTH / 2), lens.width - CARD_WIDTH / 2)) : 0;
  const below = lens ? lens.py < CARD_HEIGHT + 16 : false;
  // Background sized to ZOOM × the photo as displayed, so the lens really magnifies it ZOOM times.
  const bgW = lens ? lens.width * ZOOM : 0;
  const bgH = lens ? lens.height * ZOOM : 0;

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
          {layer === 'pores' && heatmap ? <img className="heatmapLayer" src={heatmap} alt="" aria-hidden /> : null}
          {metricHeatmap ? <img className="heatmapLayer" src={metricHeatmap} alt="" aria-hidden /> : null}

          {layer === 'areas' || layer === 'spots' ? (
            <svg className="regionOverlay" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
              {layer === 'areas'
                ? result.regions.map((r) => (
                    <polygon
                      key={r.region}
                      className={lens?.id === r.region ? 'isHovered' : undefined}
                      points={r.points.map(([x, y]) => `${x * W},${y * H}`).join(' ')}
                      onPointerMove={onRegion(r)}
                      onPointerDown={onRegion(r)}
                    />
                  ))
                : lesions.map((l, i) => (
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

      {layer === 'spots' ? (
        <p className="legend">
          <span className="legendDot red" /> {t.overlay.legendRed} <span className="legendDot dark" /> {t.overlay.legendDark}
        </p>
      ) : null}
      {layer === 'pores' ? <p className="legend">{t.overlay.legendPores}</p> : null}
      {isHeatmapLayer(layer) ? <p className="legend">{t.overlay.legendHeat[layer]}</p> : null}
    </>
  );
}
