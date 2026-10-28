"use client";

import styles from "./equipment.module.css";

type EquipmentSpot = {
  slot: string;
  x: number;
  y: number;
};

// Hotspots stay tied to the Google Sheet's real slot keys (상의 / 하의).
// Only the visible card labels are changed to 갑옷 / 바지.
const spots: EquipmentSpot[] = [
  { slot: "무기", x: 21, y: 157 },
  { slot: "보조무기", x: 140, y: 149 },
  { slot: "투구", x: 80, y: 32 },
  { slot: "상의", x: 80, y: 112 },
  { slot: "장갑", x: 42, y: 171 },
  { slot: "망토", x: 113, y: 91 },
  { slot: "신발", x: 65, y: 292 },
  { slot: "하의", x: 84, y: 199 },
  { slot: "귀걸이", x: 101, y: 49 },
  { slot: "허리띠", x: 80, y: 159 },
  { slot: "목걸이", x: 80, y: 80 },
  { slot: "반지", x: 123, y: 173 },
];

export default function EquipmentMannequin({
  activeSlot,
}: {
  activeSlot: string | null;
}) {
  const lit = (slot: string) =>
    activeSlot === slot ? styles.bodyPartActive : styles.bodyPart;
  return (
    <div className={styles.equipmentMannequin} aria-label="12개 착용 장비 부위 안내">
      <svg
        className={styles.bodyDiagram}
        viewBox="0 0 160 325"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={activeSlot ? activeSlot + " 부위 표시 중" : "투구, 상의, 장갑, 신발 등 장비 위치가 표시된 인체 실루엣"}
      >
        <defs>
          <linearGradient id="armorShape" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#655a4b" />
            <stop offset="0.52" stopColor="#39352f" />
            <stop offset="1" stopColor="#242321" />
          </linearGradient>
          <linearGradient id="armorEdge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a99474" />
            <stop offset="1" stopColor="#75634c" />
          </linearGradient>
        </defs>

        {/* Soft floor shadow and a cloak behind the torso. */}
        <ellipse cx="80" cy="311" rx="48" ry="5" fill="#b59a6d" opacity=".12" />
        <path
          className={lit("망토")}
          d="M52 77 Q35 88 30 129 L24 242 Q48 251 80 225 Q113 251 136 242 L129 126 Q122 88 108 77 Z"
          fill={activeSlot === "망토" ? "#705744" : "#302d2a"}
          stroke="#75644f"
          strokeWidth="1.6"
          opacity=".66"
        />

        {/* Head, helmet outline and neck. */}
        <path className={lit("투구")}
          d="M65 20 Q80 9 95 20 Q103 31 98 51 Q93 64 80 67 Q66 62 62 48 Q59 30 65 20Z"
          fill="url(#armorShape)" stroke="url(#armorEdge)" strokeWidth="1.7"
        />
        <path d="M64 34 Q80 24 97 34 M66 45 Q80 51 95 45"
          fill="none" stroke="#bea783" strokeWidth="1" opacity=".55" />
        <path d="M72 64 L72 77 L88 77 L88 64"
          fill="#3f3b35" stroke="#988467" strokeWidth="1.3" />

        {/* Torso, shoulders and breastplate. */}
        <path className={lit("상의")}
          d="M59 75 L71 71 L80 83 L89 71 L103 75 L117 88 L107 111 L104 148 L56 148 L53 111 L43 88Z"
          fill="url(#armorShape)" stroke="url(#armorEdge)" strokeWidth="1.8"
        />
        <path d="M56 103 Q80 114 105 103 M80 88 L80 143 M63 121 L80 130 L97 121"
          stroke="#bca27c" strokeWidth="1" opacity=".38" fill="none" />
        <path className={lit("목걸이")}
          d="M68 76 Q80 99 92 76" stroke="#a58a60" strokeWidth="3" fill="none" />

        {/* Armoured arms and gauntlets. */}
        <path d="M43 90 L54 104 L47 147 L36 158 L30 144 L33 106Z"
          fill="url(#armorShape)" stroke="#917b60" strokeWidth="1.5" />
        <path d="M117 90 L106 104 L113 147 L124 158 L130 144 L127 106Z"
          fill="url(#armorShape)" stroke="#917b60" strokeWidth="1.5" />
        <path className={lit("장갑")}
          d="M30 147 L43 153 L48 170 L41 187 L33 183 L28 164Z"
          fill="url(#armorShape)" stroke="#af9670" strokeWidth="1.8" />
        <path d="M130 147 L117 153 L112 170 L119 187 L127 183 L132 164Z"
          fill="url(#armorShape)" stroke="#af9670" strokeWidth="1.8" />

        {/* Belt + trousers */}
        <path className={lit("허리띠")}
          d="M56 147 L104 147 L105 166 L55 166Z"
          fill="#514438" stroke="#b29b75" strokeWidth="1.7" />
        <rect x="74" y="149" width="12" height="14" rx="2" fill="#8c7658" stroke="#d1ae75" strokeWidth="1" />
        <path className={lit("하의")}
          d="M57 166 L102 166 L103 202 L97 270 L82 270 L78 207 L72 270 L57 270 L54 202Z"
          fill="url(#armorShape)" stroke="#a38c6a" strokeWidth="1.7" />
        <path d="M80 169 L80 205 M59 223 L71 231 M89 231 L100 223"
          fill="none" stroke="#a48b68" opacity=".45" strokeWidth="1.2" />

        {/* Left and right boots. */}
        <path className={lit("신발")}
          d="M57 264 L73 264 L73 296 L69 303 L45 303 Q42 298 49 291Z"
          fill="url(#armorShape)" stroke="#b39b76" strokeWidth="1.7" />
        <path d="M83 264 L99 264 L111 291 Q118 297 114 303 L90 303 L84 296Z"
          fill="url(#armorShape)" stroke="#b39b76" strokeWidth="1.7" />

        {/* Equipment readout highlights only on hover or keyboard focus. */}
        {spots.map(spot => {
          const selected = spot.slot === activeSlot;
          return (
            <g key={spot.slot} className={selected ? styles.manikinSpotActive : styles.manikinSpot}>
              <circle cx={spot.x} cy={spot.y} r={selected ? 7.5 : 4.5}
                fill={selected ? "#e0b473" : "#574a39"}
                stroke={selected ? "#ffe0a4" : "#a38a62"}
                strokeWidth={selected ? 2 : 1} />
              <circle cx={spot.x} cy={spot.y} r="1.4" fill="#f4d4a0" opacity={selected ? 1 : .65} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
