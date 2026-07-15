import { shade } from "../lib/palette.js";

// sizes in meters
export const ROOMS = {
  living: { label: "סלון", wall: "#E7E0D2", floor: "#A9855C", width: 4.8 },
  bedroom: { label: "חדר שינה", wall: "#DCE3EB", floor: "#C7B295", width: 4.0 },
  kids: { label: "חדר ילדים", wall: "#FBEFD7", floor: "#D9C6A5", width: 3.4 },
  kitchen: { label: "מטבח", wall: "#EFEEE8", floor: "#9FA5A8", width: 3.8 },
  office: { label: "משרד", wall: "#E3E7E3", floor: "#8E8E8E", width: 3.6 },
};
export const WALL_H = 2.7; // m

export default function RoomScene({ room, stageW, ppm, wallPx, floorPx, snapshot, picPxW, picPxH }) {
  const M = (v) => v * ppm;
  const cfg = ROOMS[room];
  const H = wallPx + floorPx;
  const picX = (stageW - picPxW) / 2;
  const picY = Math.max(M(0.25), wallPx - M(1.5) - picPxH / 2);
  const person = (x) => (
    <g fill="rgba(40,40,45,.38)">
      <circle cx={x + M(0.14)} cy={wallPx - M(1.56)} r={M(0.12)} />
      <rect x={x + M(0.02)} y={wallPx - M(1.42)} width={M(0.24)} height={M(0.62)} rx={M(0.1)} />
      <rect x={x + M(0.04)} y={wallPx - M(0.8)} width={M(0.08)} height={M(0.8)} rx={M(0.03)} />
      <rect x={x + M(0.16)} y={wallPx - M(0.8)} width={M(0.08)} height={M(0.8)} rx={M(0.03)} />
    </g>
  );
  const shadow = (cx, w) => (
    <ellipse cx={cx} cy={wallPx + M(0.06)} rx={w / 2} ry={M(0.07)} fill="rgba(0,0,0,.20)" filter="url(#pbxblur)" />
  );

  let furniture = null;
  if (room === "living") furniture = (
    <g>
      {shadow(M(1.45), M(2.6))}
      <ellipse cx={M(1.45)} cy={wallPx + M(0.12)} rx={M(1.5)} ry={M(0.2)} fill="rgba(120,90,60,.35)" />
      <rect x={M(0.3)} y={wallPx - M(0.85)} width={M(2.3)} height={M(0.5)} rx={M(0.07)} fill="#847A6E" />
      <rect x={M(0.3)} y={wallPx - M(0.48)} width={M(2.3)} height={M(0.48)} rx={M(0.08)} fill="#948A7C" />
      <rect x={M(0.22)} y={wallPx - M(0.7)} width={M(0.22)} height={M(0.7)} rx={M(0.09)} fill="#7C7266" />
      <rect x={M(2.46)} y={wallPx - M(0.7)} width={M(0.22)} height={M(0.7)} rx={M(0.09)} fill="#7C7266" />
      <rect x={M(0.55)} y={wallPx - M(0.78)} width={M(0.55)} height={M(0.34)} rx={M(0.07)} fill="#C97B4A" />
      <rect x={M(1.18)} y={wallPx - M(0.78)} width={M(0.55)} height={M(0.34)} rx={M(0.07)} fill="#6E7F5E" />
      <rect x={M(1.81)} y={wallPx - M(0.78)} width={M(0.55)} height={M(0.34)} rx={M(0.07)} fill="#C9B38B" />
      {shadow(M(3.15), M(0.5))}
      <rect x={M(3.05)} y={wallPx - M(0.32)} width={M(0.24)} height={M(0.32)} rx={M(0.03)} fill="#A9744B" />
      <g fill="#5E7D54">
        <ellipse cx={M(3.17)} cy={wallPx - M(0.62)} rx={M(0.2)} ry={M(0.3)} />
        <ellipse cx={M(3.02)} cy={wallPx - M(0.5)} rx={M(0.13)} ry={M(0.22)} />
        <ellipse cx={M(3.33)} cy={wallPx - M(0.5)} rx={M(0.13)} ry={M(0.22)} />
      </g>
    </g>
  );
  if (room === "bedroom") furniture = (
    <g>
      {shadow(M(1.4), M(2.3))}
      <rect x={M(0.3)} y={wallPx - M(1.15)} width={M(2.2)} height={M(0.5)} rx={M(0.05)} fill="#8A6E52" />
      <rect x={M(0.36)} y={wallPx - M(0.68)} width={M(2.08)} height={M(0.36)} rx={M(0.05)} fill="#EDE7DC" />
      <rect x={M(0.36)} y={wallPx - M(0.5)} width={M(2.08)} height={M(0.5)} rx={M(0.06)} fill="#7C93A8" />
      <rect x={M(0.48)} y={wallPx - M(0.82)} width={M(0.5)} height={M(0.24)} rx={M(0.06)} fill="#FFFFFF" />
      <rect x={M(1.06)} y={wallPx - M(0.82)} width={M(0.5)} height={M(0.24)} rx={M(0.06)} fill="#FFFFFF" />
      {shadow(M(2.95), M(0.5))}
      <rect x={M(2.75)} y={wallPx - M(0.5)} width={M(0.42)} height={M(0.5)} rx={M(0.03)} fill="#8A6E52" />
      <rect x={M(2.86)} y={wallPx - M(0.78)} width={M(0.2)} height={M(0.06)} fill="#3A3E46" />
      <path d={`M ${M(2.83)} ${wallPx - M(0.78)} L ${M(3.09)} ${wallPx - M(0.78)} L ${M(3.03)} ${wallPx - M(0.95)} L ${M(2.89)} ${wallPx - M(0.95)} Z`} fill="#F0E3B8" />
    </g>
  );
  if (room === "kids") furniture = (
    <g>
      <g>
        {Array.from({ length: 9 }).map((_, i) => (
          <path key={i} d={`M ${M(0.25 + i * 0.34)} ${M(0.18)} L ${M(0.42 + i * 0.34)} ${M(0.18)} L ${M(0.335 + i * 0.34)} ${M(0.38)} Z`}
            fill={["#E44F63", "#FFE001", "#5EA5F5", "#01B14C", "#FF6600"][i % 5]} opacity="0.85" />
        ))}
        <line x1={M(0.2)} y1={M(0.18)} x2={M(3.2)} y2={M(0.18)} stroke="rgba(0,0,0,.25)" strokeWidth="1.5" />
      </g>
      {shadow(M(1.1), M(1.8))}
      <rect x={M(0.25)} y={wallPx - M(0.72)} width={M(1.7)} height={M(0.3)} rx={M(0.06)} fill="#F0716D" />
      <rect x={M(0.3)} y={wallPx - M(0.46)} width={M(1.6)} height={M(0.46)} rx={M(0.06)} fill="#FFD166" />
      <rect x={M(0.38)} y={wallPx - M(0.62)} width={M(0.42)} height={M(0.2)} rx={M(0.05)} fill="#FFFFFF" />
      {shadow(M(2.6), M(0.85))}
      <rect x={M(2.25)} y={wallPx - M(0.3)} width={M(0.3)} height={M(0.3)} rx={M(0.03)} fill="#5EA5F5" />
      <rect x={M(2.58)} y={wallPx - M(0.3)} width={M(0.3)} height={M(0.3)} rx={M(0.03)} fill="#E44F63" />
      <rect x={M(2.41)} y={wallPx - M(0.6)} width={M(0.3)} height={M(0.3)} rx={M(0.03)} fill="#FFE001" />
    </g>
  );
  if (room === "kitchen") furniture = (
    <g>
      <rect x={M(0.2)} y={M(0.35)} width={M(3.0)} height={M(0.7)} rx={M(0.02)} fill="#E8E4DA" />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={M(0.2 + (i + 1) * 0.75)} y1={M(0.35)} x2={M(0.2 + (i + 1) * 0.75)} y2={M(1.05)} stroke="rgba(0,0,0,.15)" strokeWidth="1.5" />
      ))}
      {shadow(M(1.7), M(3.0))}
      <rect x={M(0.2)} y={wallPx - M(0.95)} width={M(3.0)} height={M(0.07)} fill="#2E2E2E" />
      <rect x={M(0.2)} y={wallPx - M(0.88)} width={M(3.0)} height={M(0.88)} rx={M(0.02)} fill="#5F6B70" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={M(0.28 + i * 0.75)} y={wallPx - M(0.8)} width={M(0.62)} height={M(0.7)} rx={M(0.02)} fill="rgba(255,255,255,.08)" stroke="rgba(0,0,0,.2)" />
      ))}
      <rect x={M(1.35)} y={wallPx - M(1.14)} width={M(0.05)} height={M(0.2)} fill="#B9BDC1" />
      <path d={`M ${M(1.35)} ${wallPx - M(1.14)} q ${M(0.12)} 0 ${M(0.12)} ${M(0.08)}`} stroke="#B9BDC1" strokeWidth={M(0.045)} fill="none" />
    </g>
  );
  if (room === "office") furniture = (
    <g>
      <rect x={M(0.35)} y={M(0.75)} width={M(1.3)} height={M(0.09)} fill="#8A6E52" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={M(0.45 + i * 0.24)} y={M(0.52)} width={M(0.16)} height={M(0.23)} fill={["#C97B4A", "#5F6B70", "#6E7F5E", "#B5484D", "#3E5C76"][i]} />
      ))}
      {shadow(M(1.15), M(1.7))}
      <rect x={M(0.3)} y={wallPx - M(0.76)} width={M(1.7)} height={M(0.06)} rx={M(0.02)} fill="#A97C50" />
      <rect x={M(0.42)} y={wallPx - M(0.7)} width={M(0.07)} height={M(0.7)} fill="#8A6543" />
      <rect x={M(1.81)} y={wallPx - M(0.7)} width={M(0.07)} height={M(0.7)} fill="#8A6543" />
      <rect x={M(0.85)} y={wallPx - M(1.18)} width={M(0.6)} height={M(0.38)} rx={M(0.02)} fill="#23262C" stroke="#3A3E46" />
      <rect x={M(1.1)} y={wallPx - M(0.8)} width={M(0.1)} height={M(0.06)} fill="#3A3E46" />
      {shadow(M(2.5), M(0.6))}
      <rect x={M(2.3)} y={wallPx - M(0.52)} width={M(0.42)} height={M(0.08)} rx={M(0.04)} fill="#2E3238" />
      <rect x={M(2.46)} y={wallPx - M(0.44)} width={M(0.08)} height={M(0.44)} fill="#2E3238" />
      <rect x={M(2.28)} y={wallPx - M(1.12)} width={M(0.46)} height={M(0.62)} rx={M(0.08)} fill="#3A4048" />
    </g>
  );

  return (
    <svg width={stageW} height={H} style={{ display: "block" }}>
      <defs>
        <linearGradient id="pbxwall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(cfg.wall, 10)} />
          <stop offset="0.75" stopColor={cfg.wall} />
          <stop offset="1" stopColor={shade(cfg.wall, -16)} />
        </linearGradient>
        <linearGradient id="pbxfloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={cfg.floor} />
          <stop offset="1" stopColor={shade(cfg.floor, -36)} />
        </linearGradient>
        <filter id="pbxblur"><feGaussianBlur stdDeviation="3" /></filter>
        <filter id="pbxpic" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy={M(0.03)} stdDeviation={M(0.035)} floodColor="rgba(0,0,0,.45)" />
        </filter>
      </defs>
      <rect x="0" y="0" width={stageW} height={wallPx} fill="url(#pbxwall)" />
      <polygon points={`0,0 ${stageW * 0.42},0 ${stageW * 0.2},${wallPx} 0,${wallPx}`} fill="rgba(255,255,255,.12)" />
      <rect x="0" y={wallPx} width={stageW} height={floorPx} fill="url(#pbxfloor)" />
      {Array.from({ length: Math.ceil(stageW / M(0.65)) }).map((_, i) => (
        <line key={i} x1={M(0.65) * (i + 1)} y1={wallPx} x2={M(0.65) * (i + 1) - M(0.18)} y2={wallPx + floorPx} stroke="rgba(0,0,0,.14)" strokeWidth="1" />
      ))}
      <rect x="0" y={wallPx - 5} width={stageW} height="5" fill="rgba(255,255,255,.6)" />
      {/* the picture, true to scale, on the wall behind the furniture */}
      <g filter="url(#pbxpic)">
        <rect x={picX - 2} y={picY - 2} width={picPxW + 4} height={picPxH + 4} fill="#1B1D22" />
        <image href={snapshot} x={picX} y={picY} width={picPxW} height={picPxH} preserveAspectRatio="none" />
      </g>
      {furniture}
      {person(stageW - M(0.95))}
      {shadow(stageW - M(0.8), M(0.55))}
    </svg>
  );
}
