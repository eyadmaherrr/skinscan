/**
 * Decorative, abstract illustration of the scan: a face outline with the
 * analysed regions and a landmark-style dot mesh. Not a real face.
 */

const CX = 160;
const CY = 190;
const RX = 104;
const RY = 136;

function meshDots(): [number, number][] {
  const dots: [number, number][] = [];
  for (let y = CY - RY + 18; y <= CY + RY - 12; y += 17) {
    const row = Math.round((y - (CY - RY)) / 17);
    for (let x = CX - RX + 14 + (row % 2) * 8.5; x <= CX + RX - 12; x += 17) {
      const nx = (x - CX) / RX;
      const ny = (y - CY) / RY;
      if (nx * nx + ny * ny < 0.86) dots.push([x, y]);
    }
  }
  return dots;
}

const DOTS = meshDots();

export default function FaceScanIllustration() {
  return (
    <svg className="faceIllustration" viewBox="0 0 320 380" role="img" aria-label="Illustration of facial regions analysed by the scan">
      <defs>
        <linearGradient id="scanBeam" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2d9cdb" stopOpacity="0" />
          <stop offset="0.85" stopColor="#2d9cdb" stopOpacity="0.28" />
          <stop offset="1" stopColor="#2d9cdb" stopOpacity="0.75" />
        </linearGradient>
        <clipPath id="faceClip">
          <ellipse cx={CX} cy={CY} rx={RX} ry={RY} />
        </clipPath>
      </defs>

      {/* viewfinder corners */}
      <g className="fiCorners" fill="none" strokeWidth="3" strokeLinecap="round">
        <path d="M30 70 V40 H60" />
        <path d="M290 70 V40 H260" />
        <path d="M30 310 V340 H60" />
        <path d="M290 310 V340 H260" />
      </g>

      <ellipse className="fiOval" cx={CX} cy={CY} rx={RX} ry={RY} />

      <g clipPath="url(#faceClip)">
        <g className="fiRegions">
          <path d="M84 132 C 96 82, 224 82, 236 132 C 200 120, 120 120, 84 132 Z" />
          <ellipse cx="104" cy="226" rx="30" ry="26" />
          <ellipse cx="216" cy="226" rx="30" ry="26" />
          <rect x="146" y="176" width="28" height="44" rx="12" />
          <ellipse cx="160" cy="300" rx="34" ry="17" />
          <path d="M100 184 C 112 196, 136 196, 146 186 L 146 192 C 134 204, 110 204, 100 190 Z" />
          <path d="M220 184 C 208 196, 184 196, 174 186 L 174 192 C 186 204, 210 204, 220 190 Z" />
        </g>
        <g className="fiDots">
          {DOTS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />
          ))}
        </g>
        <rect className="fiBeam" x={CX - RX} y={CY - RY - 60} width={RX * 2} height="60" fill="url(#scanBeam)" />
      </g>

      <g className="fiFeatures" fill="none" strokeLinecap="round">
        <path d="M100 150 Q 122 138 146 148" />
        <path d="M174 148 Q 198 138 220 150" />
        <path d="M104 170 Q 123 158 142 170 Q 123 180 104 170 Z" />
        <path d="M178 170 Q 197 158 216 170 Q 197 180 178 170 Z" />
        <path d="M160 176 L 156 218 Q 160 224 168 219" />
        <path d="M134 262 Q 160 276 186 262" />
      </g>
    </svg>
  );
}
