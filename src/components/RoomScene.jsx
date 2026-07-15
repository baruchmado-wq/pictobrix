import { shade } from "../lib/palette.js";

// Wall finishes — the picture always hangs on a clean, empty wall.
export const ROOMS = {
  warm: { label: "קיר בהיר חם", wall: "#EAE3D6", floor: "#A9855C", plank: true },
  white: { label: "קיר לבן", wall: "#F2F1EE", floor: "#C9C4BC", plank: true },
  grey: { label: "קיר אפור", wall: "#D7DADD", floor: "#8E8E8E", plank: false },
  blue: { label: "קיר כחלחל", wall: "#DCE3EB", floor: "#C7B295", plank: true },
  dark: { label: "קיר כהה", wall: "#4A4E55", floor: "#3A3D42", plank: false },
};
export const WALL_W = 4.2; // m — same clean wall for every finish
export const WALL_H = 2.7; // m

export default function RoomScene({ room, stageW, ppm, wallPx, floorPx, snapshot, picPxW, picPxH }) {
  const M = (v) => v * ppm;
  const cfg = ROOMS[room];
  const H = wallPx + floorPx;
  const picX = (stageW - picPxW) / 2;
  const picY = Math.max(M(0.2), wallPx - M(1.5) - picPxH / 2);
  const dark = room === "dark";
  const sil = dark ? "rgba(255,255,255,.30)" : "rgba(40,40,45,.34)";

  return (
    <svg width={stageW} height={H} style={{ display: "block" }}>
      <defs>
        <linearGradient id="pbxwall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(cfg.wall, 12)} />
          <stop offset="0.7" stopColor={cfg.wall} />
          <stop offset="1" stopColor={shade(cfg.wall, -14)} />
        </linearGradient>
        <radialGradient id="pbxglow" cx="0.5" cy="0.32" r="0.75">
          <stop offset="0" stopColor="rgba(255,255,255,.22)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <linearGradient id="pbxfloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={cfg.floor} />
          <stop offset="1" stopColor={shade(cfg.floor, -38)} />
        </linearGradient>
        <linearGradient id="pbxreflect" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,.16)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id="pbxblur"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="pbxpic" x="-25%" y="-25%" width="150%" height="160%">
          <feDropShadow dx="0" dy={M(0.035)} stdDeviation={M(0.04)} floodColor="rgba(0,0,0,.5)" />
        </filter>
      </defs>

      {/* wall */}
      <rect x="0" y="0" width={stageW} height={wallPx} fill="url(#pbxwall)" />
      <rect x="0" y="0" width={stageW} height={wallPx} fill="url(#pbxglow)" />
      <polygon points={`0,0 ${stageW * 0.34},0 ${stageW * 0.14},${wallPx} 0,${wallPx}`} fill="rgba(255,255,255,.10)" />
      <rect x="0" y="0" width={stageW} height={M(0.05)} fill="rgba(0,0,0,.16)" />

      {/* floor */}
      <rect x="0" y={wallPx} width={stageW} height={floorPx} fill="url(#pbxfloor)" />
      {cfg.plank && Array.from({ length: Math.ceil(stageW / M(0.6)) }).map((_, i) => (
        <line key={i} x1={M(0.6) * (i + 1)} y1={wallPx} x2={M(0.6) * (i + 1) - M(0.16)} y2={wallPx + floorPx}
          stroke="rgba(0,0,0,.13)" strokeWidth="1" />
      ))}
      <rect x={picX + picPxW * 0.06} y={wallPx + 2} width={picPxW * 0.88} height={Math.min(floorPx * 0.75, M(0.3))} fill="url(#pbxreflect)" />
      <rect x="0" y={wallPx - M(0.035)} width={stageW} height={M(0.035)} fill={dark ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.75)"} />
      <rect x="0" y={wallPx} width={stageW} height="2" fill="rgba(0,0,0,.22)" />

      {/* the picture — centered on a clean wall, true to scale */}
      <g filter="url(#pbxpic)">
        <rect x={picX - 3} y={picY - 3} width={picPxW + 6} height={picPxH + 6} fill="#111318" />
        <image href={snapshot} x={picX} y={picY} width={picPxW} height={picPxH} preserveAspectRatio="none" />
        <polygon points={`${picX},${picY} ${picX + picPxW * 0.32},${picY} ${picX + picPxW * 0.1},${picY + picPxH} ${picX},${picY + picPxH}`}
          fill="rgba(255,255,255,.06)" />
      </g>

      {/* person for scale — far right, never touching the picture */}
      <g fill={sil}>
        <circle cx={stageW - M(0.42)} cy={wallPx - M(1.56)} r={M(0.12)} />
        <rect x={stageW - M(0.54)} y={wallPx - M(1.42)} width={M(0.24)} height={M(0.62)} rx={M(0.1)} />
        <rect x={stageW - M(0.52)} y={wallPx - M(0.8)} width={M(0.08)} height={M(0.8)} rx={M(0.03)} />
        <rect x={stageW - M(0.4)} y={wallPx - M(0.8)} width={M(0.08)} height={M(0.8)} rx={M(0.03)} />
      </g>
      <ellipse cx={stageW - M(0.42)} cy={wallPx + M(0.05)} rx={M(0.3)} ry={M(0.06)} fill="rgba(0,0,0,.22)" filter="url(#pbxblur)" />
    </svg>
  );
}
