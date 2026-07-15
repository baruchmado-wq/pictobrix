// Photo-based wall mockup: real room photographs with the artwork composited
// onto the empty wall, true to scale.
//
// Calibration per room (in source-photo pixels, photos are 1536x1024):
//   yCeil / yFloor - top and bottom of the wall  => pixels-per-meter (wall height 2.7m)
//   cx             - horizontal center of the empty wall area (fraction of width)
//   yBottomMax     - lowest allowed bottom edge of the artwork (above furniture)
export const ROOMS = {
  living:  { label: "סלון",             img: "/assets/rooms/living.jpg",  yCeil: 85,  yFloor: 800, cx: 0.5,  yBottomMax: 600 },
  bedroom: { label: "חדר שינה",         img: "/assets/rooms/bedroom.jpg", yCeil: 30,  yFloor: 845, cx: 0.5,  yBottomMax: 545 },
  boys:    { label: "חדר ילדים כחול",   img: "/assets/rooms/boys.jpg",    yCeil: 25,  yFloor: 830, cx: 0.40, yBottomMax: 790 },
  girls:   { label: "חדר ילדים ורוד",   img: "/assets/rooms/girls.jpg",   yCeil: 30,  yFloor: 800, cx: 0.40, yBottomMax: 760 },
  office:  { label: "משרד",             img: "/assets/rooms/office.jpg",  yCeil: 35,  yFloor: 855, cx: 0.45, yBottomMax: 815 },
  dining:  { label: "פינת אוכל",        img: "/assets/rooms/dining.jpg",  yCeil: 25,  yFloor: 880, cx: 0.5,  yBottomMax: 615 },
};

const SRC_W = 1536, SRC_H = 1024;
const WALL_H_M = 2.7;

export default function RoomScene({ room, stageW, snapshot, picWcm, picHcm }) {
  const cfg = ROOMS[room];
  const s = stageW / SRC_W;            // photo px -> screen px
  const ppm = (cfg.yFloor - cfg.yCeil) / WALL_H_M; // photo px per meter on the wall plane

  const w = (picWcm / 100) * ppm;
  const h = (picHcm / 100) * ppm;
  const x = cfg.cx * SRC_W - w / 2;
  let y = cfg.yFloor - 1.5 * ppm - h / 2;      // eye-level hanging (150cm center)
  y = Math.min(y, cfg.yBottomMax - h);          // keep above furniture
  y = Math.max(y, cfg.yCeil + 20);              // keep below ceiling

  return (
    <div style={{ position: "relative", width: stageW, height: SRC_H * s, borderRadius: 14, overflow: "hidden" }}>
      <img src={cfg.img} alt={cfg.label} style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
      {snapshot && (
        <img
          src={snapshot}
          alt=""
          style={{
            position: "absolute",
            left: x * s,
            top: y * s,
            width: w * s,
            height: h * s,
            border: `${Math.max(1.5, 3 * s)}px solid #15171c`,
            boxShadow: "0 10px 22px rgba(0,0,0,.38), 0 3px 6px rgba(0,0,0,.28)",
            background: "#fff",
          }}
        />
      )}
    </div>
  );
}
