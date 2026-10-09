/* eslint-disable @next/next/no-img-element -- local object URL / generated data URI, never sent to an image CDN */
'use client';

import { useMemo, useRef, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import type { LesionCandidate, RegionOutline, ScanSuccess } from '@/lib/skin-analysis/types';

type Layer = 'areas' | 'spots' | 'pores' | 'none';

interface Props {
  result: ScanSuccess;
  photoUrl: string;
  photoAspect: number;
}

const REGION_NAMES: Record<string, string> = {
  forehead: 'Forehead',
  nose: 'Nose',
  cheekL: 'Cheek (Photo Left)',
  cheekR: 'Cheek (Photo Right)',
  chin: 'Chin',
  underEyeL: 'Under-Eye (Photo Left)',
  underEyeR: 'Under-Eye (Photo Right)',
  jawL: 'Jawline (Photo Left)',
  jawR: 'Jawline (Photo Right)',
};

interface HoverState {
  id: string;
  title: string;
  subtitle?: string;
  details?: string;
  normX: number; // 0 to 1
  normY: number; // 0 to 1
  pixelX: number;
  pixelY: number;
  clampedX: number;
  showBelow?: boolean;
}

/**
 * The analysed photo with switchable overlays and an interactive
 * inspection lens that pops up when hovering over analyzed skin regions or spots.
 */
export default function PhotoOverlay({ result, photoUrl, photoAspect }: Props) {
  const [layer, setLayer] = useState<Layer>('areas');
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const W = 1000;
  const H = W / photoAspect;
  const lesions = result.acne?.status === 'ok' ? result.acne.lesions : [];
  const heatmap = result.pores?.status === 'ok' ? result.pores.heatmap : null;

  const options: { id: Layer; label: string; available: boolean }[] = [
    { id: 'areas', label: 'Areas', available: true },
    { id: 'spots', label: 'Spots', available: lesions.length > 0 },
    { id: 'pores', label: 'Pores', available: !!heatmap },
    { id: 'none', label: 'Photo only', available: true },
  ];

  // Map of region names to active observations
  const regionMetricsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [key, metric] of Object.entries(result.analysis)) {
      if (metric.score !== null && metric.regions?.length) {
        for (const reg of metric.regions) {
          const list = map.get(reg) || [];
          list.push(key);
          map.set(reg, list);
        }
      }
    }
    return map;
  }, [result]);

  const handleRegionHover = (r: RegionOutline, e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pixelX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pixelY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const clampedX = Math.max(120, Math.min(pixelX, rect.width - 120));
    const normX = pixelX / rect.width;
    const normY = pixelY / rect.height;

    const name = REGION_NAMES[r.region] || r.region;
    const associated = regionMetricsMap.get(r.region);
    const poreScore = result.pores?.regionalSummary?.[r.region];

    let details: string | undefined;
    if (poreScore !== undefined) {
      details = `Pore appearance index: ${poreScore}/100`;
    } else if (associated && associated.length > 0) {
      details = `Assessed characteristic: ${associated.join(', ')}`;
    } else {
      details = 'Analyzed facial zone';
    }

    setHovered({
      id: r.region,
      title: name,
      details,
      normX,
      normY,
      pixelX,
      pixelY,
      clampedX,
      showBelow: pixelY < 230,
    });
  };

  const handleSpotHover = (l: LesionCandidate, index: number, e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pixelX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pixelY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const clampedX = Math.max(120, Math.min(pixelX, rect.width - 120));

    const isRed = l.tone === 'red';
    setHovered({
      id: `spot-${index}`,
      title: isRed ? 'Inflammatory Spot' : 'Pigmented Mark',
      details: isRed ? 'Erythematous candidate focus' : 'Hyperpigmented spot focus',
      normX: l.x,
      normY: l.y,
      pixelX,
      pixelY,
      clampedX,
      showBelow: pixelY < 230,
    });
  };

  const handlePointerLeave = () => {
    setHovered(null);
  };

  // Zoom math for pop-up lens
  const zoomFactor = 3.0;
  const lensWidth = 216;
  const lensHeight = 216;
  const zoomedImgW = lensWidth * zoomFactor;
  const zoomedImgH = zoomedImgW / photoAspect;

  const bgX = hovered ? lensWidth / 2 - hovered.normX * zoomedImgW : 0;
  const bgY = hovered ? lensHeight / 2 - hovered.normY * zoomedImgH : 0;

  return (
    <>
      <div className="photoFrameWrapper">
        <div
          ref={containerRef}
          className="photoFrame resultPhoto"
          style={{ aspectRatio: String(photoAspect) }}
          onMouseLeave={handlePointerLeave}
        >
          <img src={photoUrl} alt="Your analysed photo" />
          {layer === 'pores' && heatmap ? <img className="heatmapLayer" src={heatmap} alt="" aria-hidden /> : null}

          {layer === 'areas' || layer === 'spots' ? (
            <svg className="regionOverlay" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
              {layer === 'areas'
                ? result.regions.map((r) => (
                    <polygon
                      key={r.region}
                      className={hovered?.id === r.region ? 'isHovered' : undefined}
                      points={r.points.map(([x, y]) => `${x * W},${y * H}`).join(' ')}
                      onMouseEnter={(e) => handleRegionHover(r, e)}
                      onMouseMove={(e) => handleRegionHover(r, e)}
                    />
                  ))
                : lesions.map((l, i) => (
                    <circle
                      key={i}
                      className={`${l.tone === 'red' ? 'spotRed' : 'spotDark'} ${hovered?.id === `spot-${i}` ? 'isHovered' : ''}`}
                      cx={l.x * W}
                      cy={l.y * H}
                      r={Math.max(6, l.r * W * 1.6)}
                      onMouseEnter={(e) => handleSpotHover(l, i, e)}
                      onMouseMove={(e) => handleSpotHover(l, i, e)}
                    />
                  ))}
            </svg>
          ) : null}
        </div>

        {/* Floating Zoom Inspection Pop-up Card */}
        {hovered ? (
          <div
            className="zoomPopupCard"
            style={{
              left: `${hovered.clampedX}px`,
              top: `${hovered.pixelY}px`,
              transform: hovered.showBelow ? 'translate(-50%, 20px)' : 'translate(-50%, -100%)',
              marginTop: hovered.showBelow ? '0' : '-16px',
            }}
            aria-live="polite"
          >
            <div className="zoomPopupHeader">
              <div className="zoomPopupTitle">
                <Search size={14} aria-hidden />
                <span>{hovered.title}</span>
              </div>
              <span className="zoomBadge">3x Zoom</span>
            </div>

            <div className="zoomLensContainer">
              <div
                className="zoomLensImage"
                style={{
                  backgroundImage: `url(${photoUrl})`,
                  backgroundSize: `${zoomedImgW}px ${zoomedImgH}px`,
                  backgroundPosition: `${bgX}px ${bgY}px`,
                  backgroundRepeat: 'no-repeat',
                }}
              />
              <div className="zoomReticle" aria-hidden />
            </div>

            {hovered.details ? (
              <div className="zoomPopupFooter">
                <span>{hovered.details}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="zoomHint">
        <Sparkles size={13} aria-hidden />
        <span>Hover over any analyzed area or spot to inspect zoomed in</span>
      </div>

      <div className="layerSwitch" role="radiogroup" aria-label="Photo overlay">
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
                setHovered(null);
              }}
            >
              {o.label}
            </button>
          ))}
      </div>

      {layer === 'spots' ? (
        <p className="legend">
          <span className="legendDot red" /> red-toned <span className="legendDot dark" /> darker-toned spot candidates
        </p>
      ) : null}
      {layer === 'pores' ? <p className="legend">Brighter violet = more visible pores (appearance estimate).</p> : null}
    </>
  );
}
