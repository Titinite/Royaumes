'use client'
import { type PointerEvent, useEffect, useRef, useState } from 'react'
import { GameIcon } from '@/ui/game-icon'
import type { Effect, GameView, HeroView, Monster } from './contracts'

/**
 * Composants de l'arène du Donjon : couloir des salles, bougie de la manche, combattants,
 * main de cartes, et rejeu animé de la dernière manche. Ils n'affichent que la vue filtrée
 * reçue de l'API : aucune règle du jeu n'est calculée ici.
 */

// ---------------------------------------------------------------------------
// Lueur de torche : la lumière suit le pointeur, sans provoquer de nouveau rendu.
// ---------------------------------------------------------------------------

/** Propriétés à poser sur l'arène pour que la lueur suive le pointeur. */
export function useTorchlight() {
  const ref = useRef<HTMLDivElement>(null)
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const box = ref.current?.getBoundingClientRect()
    if (!box || !ref.current) return
    ref.current.style.setProperty('--lx', `${event.clientX - box.left}px`)
    ref.current.style.setProperty('--ly', `${event.clientY - box.top}px`)
  }
  return { ref, onPointerMove }
}

// ---------------------------------------------------------------------------
// Couloir des salles
// ---------------------------------------------------------------------------

/** Les salles de l'expédition : franchies, courante (avec la torche), à venir, et le boss. */
export function Corridor({ room, roomCount }: { room: number; roomCount: number }) {
  const rooms = Array.from({ length: roomCount }, (_, i) => i)
  return (
    <ol className="corridor" aria-label={`Salle ${Math.max(room + 1, 0)} sur ${roomCount}`}>
      {rooms.map((i) => {
        const state = i < room ? 'done' : i === room ? 'here' : 'next'
        const boss = i === roomCount - 1
        return (
          <li key={`room-${i}`} className="corridor-room" data-state={state} data-boss={boss}>
            {state === 'here' && (
              <span className="corridor-torch">
                <GameIcon kind="torch" size={20} />
              </span>
            )}
            <GameIcon kind={boss ? 'boss' : 'door'} size={24} />
          </li>
        )
      })}
    </ol>
  )
}

// ---------------------------------------------------------------------------
// Bougie : le temps restant de la manche ou du tour d'exploration
// ---------------------------------------------------------------------------

/** Bougie qui fond avec le temps restant ; le nombre de secondes reste affiché. */
export function Candle({ remaining, total }: { remaining: number; total: number }) {
  const ratio = Math.max(0.08, Math.min(1, remaining / total))
  return (
    <div className="candle" role="timer" aria-label={`${remaining} secondes restantes`}>
      <div className="candle-body" style={{ '--wax': ratio } as React.CSSProperties}>
        <span className="candle-flame" />
        <span className="candle-wax" />
      </div>
      <span className="candle-dish" />
      <strong>{remaining} s</strong>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rejeu de la dernière manche
// ---------------------------------------------------------------------------

/** Effet en cours de rejeu ; key relance les animations, même sur la même cible. */
export interface PlayingEffect {
  key: number
  kind: Effect['kind']
  target: string
  amount: number
}

/** Délai entre deux effets rejoués, en millisecondes. */
const STEP_MS = 650

/**
 * Rejoue, un effet après l'autre, la manche qui vient d'être résolue. lastRound vaut undefined
 * tant que la vue n'est pas chargée, null avant la première manche. La manche présente au
 * chargement n'est pas rejouée : seule une manche résolue pendant que le joueur regarde l'est.
 */
export function useRoundReplay(lastRound: GameView['lastRound'] | undefined) {
  const [playing, setPlaying] = useState<PlayingEffect | null>(null)
  // Numéro de la dernière manche connue ; undefined avant le chargement de la vue.
  const seen = useRef<number | undefined>(undefined)
  // Minuteries du rejeu en cours : une relecture de la vue ne doit pas l'interrompre.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const loaded = lastRound !== undefined
  const round = lastRound?.round ?? 0
  const effects = lastRound?.effects
  useEffect(() => {
    if (!loaded) return
    if (seen.current === undefined || round === seen.current || !effects) {
      seen.current = round
      return
    }
    seen.current = round
    // Les animations sont ignorées si le joueur a demandé à les réduire.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const timer of timers.current) clearTimeout(timer)
    timers.current = effects.map((effect, i) =>
      setTimeout(() => setPlaying({ key: round * 100 + i, ...effect }), i * STEP_MS),
    )
    timers.current.push(setTimeout(() => setPlaying(null), effects.length * STEP_MS + 900))
  }, [loaded, round, effects])

  // Les minuteries sont annulées lorsque l'écran est quitté.
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  return playing
}

/** Marques visuelles d'un effet sur sa cible : entaille et dégâts, ou étincelles et soin. */
function EffectMark({ effect }: { effect: PlayingEffect }) {
  return effect.kind === 'damage' ? (
    <span key={effect.key} className="fx" aria-hidden="true">
      <svg className="fx-slash" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M12 18 L88 82" />
        <path d="M24 10 L94 66" />
      </svg>
      <span className="fx-number fx-damage">-{effect.amount}</span>
    </span>
  ) : (
    <span key={effect.key} className="fx" aria-hidden="true">
      <span className="fx-sparkles" />
      <span className="fx-number fx-heal">+{effect.amount}</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Combattants
// ---------------------------------------------------------------------------

/** Barre de points de vie. */
function HpBar({ hp, maxHp, kind }: { hp: number; maxHp: number; kind: 'hero' | 'monster' }) {
  return (
    <span className={`hp hp-${kind}`}>
      <i style={{ width: `${Math.max(0, (hp / maxHp) * 100)}%` }} />
    </span>
  )
}

/** Un monstre : silhouette, nom et points de vie ; une cible cliquable pendant le choix. */
export function MonsterFighter({
  monster,
  name,
  targetable,
  effect,
  onTarget,
}: {
  monster: Monster
  name: string
  targetable: boolean
  effect: PlayingEffect | null
  onTarget: () => void
}) {
  const down = monster.hp <= 0
  const hit = effect?.target === monster.id ? effect : null
  return (
    <button
      type="button"
      className="monster"
      data-down={down}
      data-targetable={targetable}
      disabled={!targetable}
      onClick={onTarget}
      aria-label={`${name}, ${monster.hp} sur ${monster.maxHp} points de vie${targetable ? ' : attaquer' : ''}`}
    >
      <span
        key={`figure-${hit?.key ?? 'idle'}`}
        className={hit ? 'monster-figure is-hit' : 'monster-figure'}
      >
        <GameIcon kind={monster.kind} size={112} />
      </span>
      {hit && <EffectMark key={`fx-${hit.key}`} effect={hit} />}
      <span className="monster-name">{name}</span>
      <HpBar hp={monster.hp} maxHp={monster.maxHp} kind="monster" />
      <small>
        {Math.max(0, monster.hp)} / {monster.maxHp}
      </small>
    </button>
  )
}

/** Un héros : portrait, nom, points de vie, et sceau de cire lorsqu'il est prêt. */
export function HeroCard({
  hero,
  me,
  turn,
  targetable,
  effect,
  onTarget,
}: {
  hero: HeroView
  me: boolean
  turn: boolean
  targetable: boolean
  effect: PlayingEffect | null
  onTarget: () => void
}) {
  const hit = effect?.target === hero.id ? effect : null
  return (
    <button
      type="button"
      className="hero-card"
      data-me={me}
      data-down={hero.hp <= 0}
      data-targetable={targetable}
      disabled={!targetable}
      onClick={onTarget}
      aria-label={`${hero.name}, ${hero.hp} sur ${hero.maxHp} points de vie${hero.ready ? ', prêt' : ''}${targetable ? ' : soigner' : ''}`}
    >
      {hero.ready && <span className="wax-seal">✓</span>}
      <span
        key={`figure-${hit?.key ?? 'idle'}`}
        className={hit ? 'hero-portrait is-hit' : 'hero-portrait'}
      >
        <GameIcon kind={hero.companion ? 'companion' : 'hero'} size={36} />
      </span>
      {hit && <EffectMark key={`fx-${hit.key}`} effect={hit} />}
      <span className="hero-info">
        <strong>
          {hero.name}
          {me && <em>toi</em>}
          {hero.companion && <em>IA</em>}
          {turn && <em>à son tour</em>}
        </strong>
        <HpBar hp={hero.hp} maxHp={hero.maxHp} kind="hero" />
        <small>
          {Math.max(0, hero.hp)} / {hero.maxHp} PV
        </small>
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main de cartes
// ---------------------------------------------------------------------------

export type CardKind = 'attack' | 'defend' | 'heal'

const CARDS: { kind: CardKind; title: string; text: string }[] = [
  { kind: 'defend', title: 'Défendre', text: 'Réduit les coups reçus' },
  { kind: 'attack', title: 'Attaquer', text: 'Frappe un monstre' },
  { kind: 'heal', title: 'Soigner', text: 'Rend des PV à un allié' },
]

/** Les trois cartes d'action ; la carte choisie se soulève en attendant sa cible. */
export function ActionHand({
  selected,
  onPick,
}: {
  selected: CardKind | null
  onPick: (kind: CardKind) => void
}) {
  return (
    <fieldset className="hand">
      <legend className="sr-only">Votre action</legend>
      {CARDS.map((card) => (
        <button
          key={card.kind}
          type="button"
          className="action-card"
          aria-pressed={selected === card.kind}
          onClick={() => onPick(card.kind)}
        >
          <GameIcon kind={card.kind} size={40} />
          <strong>{card.title}</strong>
          <small>{card.text}</small>
        </button>
      ))}
    </fieldset>
  )
}
