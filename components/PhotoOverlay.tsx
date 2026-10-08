/* eslint-disable @next/next/no-img-element -- local object URL / generated data URI, never sent to an image CDN */
'use client';

import { useState } from 'react';
import type { ScanSuccess } from '@/lib/skin-analysis/types';

type Layer = 'areas' | 'spots' | 'pores' | 'none';

interface Props {
  result: ScanSuccess;
  photoUrl: string;
  photoAspect: number;
}

/**
 * The analysed photo with switchable overlays. All overlays use normalised
 * coordinates of the full photo (same aspect ratio as the displayed image),
 * so they stay aligned at any size; "Photo only" shows it unannotated.
 */
export default function PhotoOverlay({ result, photoUrl, photoAspect }: Props) {
  const [layer, setLayer] = useState<Layer>('areas');
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

  return (
    <>
      <div className="photoFrame resultPhoto" style={{ aspectRatio: String(photoAspect) }}>
        <img src={photoUrl} alt="Your analysed photo" />
        {layer === 'pores' && heatmap ? <img className="heatmapLayer" src={heatmap} alt="" aria-hidden /> : null}
        {layer === 'areas' || layer === 'spots' ? (
          <svg className="regionOverlay" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
            {layer === 'areas'
              ? result.regions.map((r) => (
                  <polygon key={r.region} points={r.points.map(([x, y]) => `${x * W},${y * H}`).join(' ')} />
                ))
              : lesions.map((l, i) => (
                  <circle
                    key={i}
                    className={l.tone === 'red' ? 'spotRed' : 'spotDark'}
                    cx={l.x * W}
                    cy={l.y * H}
                    r={Math.max(6, l.r * W * 1.6)}
                  />
                ))}
          </svg>
        ) : null}
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
              onClick={() => setLayer(o.id)}
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
