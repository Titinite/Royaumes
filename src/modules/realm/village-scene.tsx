import type { Building } from './contracts'

/**
 * Scène illustrée du village : décor, hôtel de ville et quatre bâtiments, dessinés en SVG.
 * Les couleurs sont des variables CSS (globals.css) : le thème sombre transforme la scène
 * en scène de nuit, sans autre code. La scène est décorative pour les lecteurs d'écran :
 * les bâtiments sont présentés et sélectionnés par les boutons superposés de VillageScreen.
 */

/** Position de chaque bâtiment dans la scène (unités du viewBox 880 × 430). */
export const BUILDING_SPOTS: Record<Building, { x: number; y: number }> = {
  mine: { x: 210, y: 215 },
  mill: { x: 700, y: 205 },
  sawmill: { x: 205, y: 330 },
  quarry: { x: 690, y: 335 },
}

/** Position de l'hôtel de ville, où se tient le festin. */
export const HALL_SPOT = { x: 440, y: 225 }

/** Dimensions de la scène, pour convertir une position en pourcentage. */
export const SCENE = { width: 880, height: 430 }

/** Arbre décoratif. */
function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect className="v-wood" x="-3" y="0" width="6" height="14" rx="2" />
      <circle className="v-leaf" cx="0" cy="-8" r="14" />
      <circle className="v-leaf2" cx="-8" cy="-2" r="9" />
      <circle className="v-leaf2" cx="8" cy="-3" r="10" />
    </g>
  )
}

/** Facteur d'échelle d'un bâtiment : il grandit légèrement avec son niveau. */
const scaleOf = (level: number) => 0.9 + Math.min(level, 10) * 0.025

/** Drapeau planté sur un bâtiment de niveau 5 ou plus. */
function Pennant({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path className="v-pole" d="M0 0 v-26" strokeWidth="2.5" />
      <path className="v-flag" d="M0 -26 h18 l-5 6 l5 6 h-18z" />
    </g>
  )
}

/** Pile de rondins de la scierie : trois rangées, de la base au sommet. */
const LOGS = [0, 1, 2].flatMap((row) =>
  Array.from({ length: 3 - row }, (_, k) => [-74 + k * 11 + row * 5.5, 14 - row * 9] as const),
)

/** Rangées de blé du champ du moulin. */
const WHEAT_ROWS = [-120, -106, -92, -78, -64, -50]

function Sawmill({ level }: { level: number }) {
  return (
    <>
      <rect className="v-wood" x="-48" y="-30" width="72" height="50" />
      <path className="v-roof" d="M-56 -28 L-12 -62 L32 -28Z" />
      <rect className="v-door" x="-18" y="-6" width="16" height="26" />
      <g className="v-saw" transform="translate(42 0)">
        <circle className="v-metal" r="17" />
        <circle className="v-metal-dark" r="4" />
        <path className="v-metal-dark" d="M-17 0 h34 M0 -17 v34" strokeWidth="2" />
      </g>
      {LOGS.map(([cx, cy]) => (
        <circle key={`log-${cx}-${cy}`} className="v-log" cx={cx} cy={cy} r="5.5" />
      ))}
      {level >= 5 && <Pennant x={-12} y={-62} />}
    </>
  )
}

function Quarry({ level }: { level: number }) {
  return (
    <>
      <path className="v-stone" d="M-70 20 L-55 -35 L-20 -55 L25 -45 L60 -20 L70 20Z" />
      <path className="v-stone-dark" d="M-35 20 L-28 -20 L10 -25 L20 20Z" />
      <rect className="v-block" x="-62" y="5" width="22" height="15" />
      <rect className="v-block" x="34" y="5" width="22" height="15" />
      <rect className="v-block" x="45" y="-10" width="22" height="15" />
      <path className="v-pole" d="M-8 -30 l18 -18" strokeWidth="4" />
      {level >= 5 && <Pennant x={-20} y={-55} />}
    </>
  )
}

function Mine({ level }: { level: number }) {
  return (
    <>
      <path className="v-stone-dark" d="M-70 10 Q-40 -55 0 -55 Q40 -55 70 10Z" />
      <path className="v-door" d="M-22 10 v-28 a22 22 0 0 1 44 0 v28z" />
      <path className="v-pole" d="M-30 -20 h60 M-26 -20 v30 M26 -20 v30" strokeWidth="5" />
      <g transform="translate(40 2)">
        <rect className="v-wood" x="-10" y="-8" width="20" height="10" rx="2" />
        <circle className="v-gold" cx="-4" cy="-10" r="4" />
        <circle className="v-gold" cx="4" cy="-11" r="4" />
      </g>
      {level >= 5 && <Pennant x={0} y={-55} />}
    </>
  )
}

function Mill({ level }: { level: number }) {
  return (
    <>
      {WHEAT_ROWS.map((x) => (
        <rect key={`wheat-${x}`} className="v-field" x={x} y="-6" width="9" height="26" rx="4" />
      ))}
      <path className="v-wall" d="M-18 15 L-12 -45 H12 L18 15Z" />
      <path className="v-roof" d="M-15 -45 L0 -62 L15 -45Z" />
      <rect className="v-door" x="-5" y="-2" width="10" height="17" rx="5" />
      <g transform="translate(0 -42)">
        <g className={level > 0 ? 'v-blades v-spin' : 'v-blades'}>
          <rect className="v-wood" x="-3" y="-42" width="6" height="84" />
          <rect className="v-wood" x="-42" y="-3" width="84" height="6" />
        </g>
        <circle className="v-roof" r="5" />
      </g>
      {level >= 5 && <Pennant x={30} y={10} />}
    </>
  )
}

const DRAWINGS: Record<Building, (props: { level: number }) => React.JSX.Element> = {
  sawmill: Sawmill,
  quarry: Quarry,
  mine: Mine,
  mill: Mill,
}

/** Un bâtiment à sa place, en chantier s'il n'est pas encore construit. */
function BuildingDrawing({
  building,
  level,
  selected,
  bumped,
}: {
  building: Building
  level: number
  selected: boolean
  bumped: boolean
}) {
  const { x, y } = BUILDING_SPOTS[building]
  const Drawing = DRAWINGS[building]
  const classes = ['v-building', level === 0 && 'v-site', bumped && 'v-bump'].filter(Boolean)
  return (
    <g transform={`translate(${x} ${y})`}>
      {selected && <ellipse className="v-selected" cx="0" cy="22" rx="80" ry="16" />}
      <g className={classes.join(' ')}>
        <g transform={`scale(${scaleOf(level)})`}>
          <Drawing level={level} />
        </g>
      </g>
      {level === 0 && (
        <g transform="translate(52 -10)">
          <rect className="v-pole-fill" x="-2" y="0" width="4" height="22" />
          <rect className="v-sign" x="-24" y="-14" width="48" height="18" rx="3" />
          <text className="v-sign-text" textAnchor="middle" y="0">
            À BÂTIR
          </text>
        </g>
      )}
    </g>
  )
}

/** Lanternes tendues entre les tours de l'hôtel de ville, pendant un festin. */
const LANTERNS = [-46, -28, -10, 10, 28, 46]

/** Hauteur de la guirlande à l'abscisse x : courbe de Bézier de -58 à 58, creusée de 13 unités. */
const sag = (x: number) => {
  const t = (x + 58) / 116
  return 52 * t * (1 - t)
}

/** Mets posés sur la table du festin : position et couleur (pain, blé, fruits). */
const DISHES = [
  { x: -58, fill: '#c98a3f' },
  { x: -34, fill: '#e8c25a' },
  { x: -10, fill: '#b4553a' },
  { x: 14, fill: '#c98a3f' },
  { x: 38, fill: '#e8c25a' },
  { x: 60, fill: '#7a9a3a' },
]

/** Décor du festin : guirlande de lanternes sur l'hôtel de ville, et table dressée devant. */
function FeastDecor() {
  return (
    <g className="v-feast">
      <g transform="translate(440 145)">
        <path className="v-garland" d="M-58 0 Q0 26 58 0" />
        {LANTERNS.map((x, i) => (
          <circle
            key={`lantern-${x}`}
            className="v-lantern"
            cx={x}
            cy={sag(x) + 5}
            r="4.5"
            style={{ animationDelay: `${i * 0.35}s` }}
          />
        ))}
      </g>
      <g transform="translate(440 352)">
        <ellipse className="v-feast-glow" rx="110" ry="30" />
        <rect className="v-wood" x="-78" y="-6" width="156" height="10" rx="3" />
        <rect className="v-wood" x="-70" y="4" width="6" height="16" />
        <rect className="v-wood" x="64" y="4" width="6" height="16" />
        <rect className="v-cloth" x="-74" y="-8" width="148" height="5" rx="2" />
        {DISHES.map((d) => (
          <ellipse key={`dish-${d.x}`} cx={d.x} cy="-12" rx="8" ry="6" fill={d.fill} />
        ))}
        <path className="v-steam" d="M-34 -22 q4 -6 0 -12 q-4 -6 0 -12" />
        <path className="v-steam" d="M14 -22 q4 -6 0 -12 q-4 -6 0 -12" />
      </g>
    </g>
  )
}

/** Décor du village, avec ses bâtiments à leur niveau actuel. */
export function VillageScene({
  name,
  levels,
  selected,
  bumped,
  feasting,
}: {
  name: string
  levels: Record<Building, number>
  /** Bâtiment sélectionné, ou hall pour l'hôtel de ville. */
  selected: Building | 'hall' | null
  bumped: Building | null
  /** Vrai pendant un festin : la scène est décorée. */
  feasting: boolean
}) {
  const stakes = Array.from({ length: 40 }, (_, i) => 20 + i * 21)
  const stars = Array.from({ length: 36 }, (_, i) => ({
    x: (i * 211) % 880,
    y: ((i * 137) % 130) + 10,
  }))
  return (
    <svg
      className="village-scene"
      viewBox={`0 0 ${SCENE.width} ${SCENE.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="v-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="v-sky1" />
          <stop offset="1" className="v-sky2" />
        </linearGradient>
      </defs>
      <rect width="880" height="430" fill="url(#v-sky)" />

      {/* Jour : soleil et nuages ; nuit : lune et étoiles (selon le thème). */}
      <g className="v-day">
        <circle cx="770" cy="60" r="26" className="v-sun" />
        <ellipse className="v-cloud" cx="180" cy="62" rx="48" ry="14" />
        <ellipse className="v-cloud" cx="215" cy="54" rx="30" ry="12" />
        <ellipse className="v-cloud" cx="560" cy="85" rx="40" ry="11" />
      </g>
      <g className="v-night">
        {stars.map((s) => (
          <circle key={`star-${s.x}-${s.y}`} className="v-star" cx={s.x} cy={s.y} r="1.3" />
        ))}
        <circle cx="760" cy="55" r="22" className="v-moon" />
        <circle cx="770" cy="48" r="20" className="v-moon-shadow" />
      </g>

      <path className="v-far" d="M0 175 Q120 120 240 160 T480 150 T720 140 T880 160 V430 H0Z" />
      <path className="v-hill" d="M0 215 Q160 170 330 205 T640 195 T880 205 V430 H0Z" />
      <path className="v-ground" d="M0 250 Q220 225 440 245 T880 240 V430 H0Z" />
      <path
        className="v-water"
        d="M600 430 Q640 380 720 360 T880 330 V350 Q800 360 740 380 T640 430Z"
      />
      <path
        className="v-path"
        d="M440 430 Q430 360 440 300 M440 300 Q330 300 200 330 M440 300 Q560 300 690 330 M440 300 Q330 260 210 220 M440 300 Q560 260 690 215"
      />
      {stakes.map((x) => (
        <path key={`stake-${x}`} className="v-stake" d={`M${x} 200 v-20 l5 -6 l5 6 v20z`} />
      ))}
      <Tree x={60} y={270} />
      <Tree x={95} y={300} s={0.8} />
      <Tree x={820} y={285} />
      <Tree x={560} y={380} s={0.9} />
      <Tree x={300} y={385} s={1.1} />
      <Tree x={330} y={255} s={0.7} />

      {/* Hôtel de ville, au centre : il porte le nom du village. */}
      <g transform={`translate(${HALL_SPOT.x} ${HALL_SPOT.y})`}>
        {selected === 'hall' && <ellipse className="v-selected" cx="0" cy="12" rx="95" ry="18" />}
        <circle className="v-glow" r="80" cy="-20" />
        <rect className="v-wall" x="-55" y="-55" width="110" height="65" />
        <rect className="v-stone" x="-75" y="-80" width="34" height="90" />
        <rect className="v-stone" x="41" y="-80" width="34" height="90" />
        {[-75, -64, -53, 41, 52, 63].map((x) => (
          <rect key={`merlon-${x}`} className="v-stone" x={x} y="-90" width="9" height="11" />
        ))}
        <rect className="v-wall" x="-25" y="-95" width="50" height="105" />
        {[-25, -12, 1, 14].map((x) => (
          <rect key={`keep-${x}`} className="v-wall" x={x} y="-105" width="11" height="12" />
        ))}
        <path className="v-window" d="M-14 10 v-26 a14 14 0 0 1 28 0 v26z" />
        <rect className="v-window" x="-6" y="-70" width="12" height="16" rx="6" />
        <rect className="v-window" x="-63" y="-55" width="10" height="14" rx="5" />
        <rect className="v-window" x="53" y="-55" width="10" height="14" rx="5" />
        <path className="v-pole" d="M0 -105 v-32" strokeWidth="3" />
        <path className="v-flag v-wave" d="M0 -137 h26 l-7 8 l7 8 h-26z" />
      </g>
      {feasting && <FeastDecor />}
      <g transform="translate(440 270)">
        <rect className="v-banner" x="-62" y="-13" width="124" height="26" rx="13" />
        <text className="v-banner-text" textAnchor="middle" dy="5">
          {name}
        </text>
      </g>

      {(Object.keys(BUILDING_SPOTS) as Building[]).map((b) => (
        <BuildingDrawing
          key={b}
          building={b}
          level={levels[b]}
          selected={selected === b}
          bumped={bumped === b}
        />
      ))}
    </svg>
  )
}
