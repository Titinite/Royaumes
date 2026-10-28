'use client'
import { hc } from 'hono/client'
import { useCallback, useEffect, useState } from 'react'
import { useChannel } from '@/platform/realtime/use-channel'
import { Entity } from '@/ui/entity'
import { GameIcon } from '@/ui/game-icon'
import { look } from '@/ui/theme'
import type { RealmApi } from './api'
import {
  BUILDINGS,
  type Building,
  CATALOG,
  type DomainError,
  FEAST,
  type Feast,
  feastAt,
  RESOURCES,
  type Stock,
  stockAt,
  type VillageView,
  villageChannel,
} from './contracts'
import { BUILDING_SPOTS, HALL_SPOT, SCENE, VillageScene } from './village-scene'

/** Client HTTP typé, déduit de la sous-application Hono du module. */
const client = hc<RealmApi>('/api/realm')

/** Erreurs que l'API peut renvoyer : erreurs métier et erreur de validation. */
type ApiError = { code: DomainError['code'] | 'INVALID_INPUT'; message?: string }

/** Message affiché au joueur pour chaque erreur. */
const ERRORS: Record<ApiError['code'], string> = {
  INVALID_INPUT: 'Saisie invalide.',
  ALREADY_FOUNDED: 'Village déjà fondé.',
  NOT_FOUNDED: "Aucun village pour l'instant.",
  MAX_LEVEL_REACHED: 'Niveau maximum atteint.',
  INSUFFICIENT_RESOURCES: 'Ressources insuffisantes.',
  FEAST_IN_PROGRESS: 'Un festin est déjà en cours.',
}

/** Indique si le stock couvre un coût ; faux si le coût est absent (niveau maximal). */
function canAfford(stock: Stock, cost: Partial<Stock> | null) {
  return !!cost && Object.entries(cost).every(([r, n]) => stock[r as keyof Stock] >= (n ?? 0))
}

/** Libellé affiché pour chaque état de la connexion temps réel. */
const STATUS_LABELS = {
  connecting: 'Connexion...',
  open: 'Temps réel connecté',
  reconnecting: 'Reconnexion...',
} as const

/**
 * Zone cliquable d'un bâtiment, en pourcentage de la scène : elle couvre sa silhouette,
 * de 68 unités au-dessus de son point d'ancrage à 22 unités au-dessous.
 */
const spotOf = (b: Building) => ({
  left: `${(BUILDING_SPOTS[b].x / SCENE.width) * 100}%`,
  top: `${((BUILDING_SPOTS[b].y - 68) / SCENE.height) * 100}%`,
  height: `${(90 / SCENE.height) * 100}%`,
})

/**
 * Zone cliquable de l'hôtel de ville : elle couvre ses tours, de 140 unités au-dessus de son
 * point d'ancrage jusqu'à la bannière du nom du village.
 */
const HALL_STYLE = {
  left: `${(HALL_SPOT.x / SCENE.width) * 100}%`,
  top: `${((HALL_SPOT.y - 140) / SCENE.height) * 100}%`,
  height: `${(198 / SCENE.height) * 100}%`,
}

/** Niveau d'un bâtiment en chiffres romains, gravé sur sa plaque (de I à X). */
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
const roman = (level: number) => ROMAN[level] ?? String(level)

/** Grossissement de la caméra sur un bâtiment, et sur l'hôtel de ville, plus haut. */
const ZOOM = { building: 2, hall: 1.7 }

/**
 * Caméra : position de la scène pour cadrer un élément de la scène, à l'échelle zoom.
 * Le plan d'architecte occupe un côté de la scène : l'élément est cadré dans l'autre côté
 * (focusX), sur grand écran. Sur petit écran, le plan passe sous la scène : l'élément est centré.
 * Le déplacement est borné, pour ne jamais montrer le vide autour de la scène.
 */
function cameraOn(x: number, y: number, zoom: number, focusX: number) {
  const clamp = (v: number) => Math.min(0, Math.max(1 - zoom, v))
  const px = x / SCENE.width
  const py = y / SCENE.height
  return {
    '--zoom': zoom,
    '--tx': `${clamp(focusX - zoom * px) * 100}%`,
    '--tx-narrow': `${clamp(0.5 - zoom * px) * 100}%`,
    '--ty': `${clamp(0.5 - zoom * py) * 100}%`,
  } as React.CSSProperties
}

/** Durée restante, au format minutes:secondes. */
function formatRemaining(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Coût, présenté par les icônes des ressources ; une ressource insuffisante est signalée. */
function CostView({ cost, stock }: { cost: Partial<Stock>; stock: Stock }) {
  return (
    <span className="cost">
      {Object.entries(cost).map(([r, n]) => (
        <span key={r} data-missing={stock[r as keyof Stock] < (n ?? 0) || undefined}>
          <GameIcon kind={r} size={16} /> {n}
        </span>
      ))}
    </span>
  )
}

/** Côté de la scène où s'ouvre le plan : à l'opposé de l'élément, pour ne pas le masquer. */
type Side = 'left' | 'right'
const sideOf = (x: number): Side => (x < SCENE.width / 2 ? 'right' : 'left')

/** Plan d'architecte : cadre commun aux panneaux des bâtiments et de l'hôtel de ville. */
function Blueprint({
  side,
  kicker,
  title,
  error,
  onClose,
  children,
}: {
  side: Side
  kicker: string
  title: string
  error: string | null
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <section className="blueprint" data-side={side} aria-label={title}>
      <header className="blueprint-head">
        <div>
          <small>{kicker}</small>
          <h3>{title}</h3>
        </div>
        <button
          type="button"
          className="blueprint-close"
          onClick={onClose}
          aria-label="Fermer le plan"
        >
          ×
        </button>
      </header>
      {children}
      {error && (
        <p className="blueprint-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

/** Plan d'un bâtiment : niveau actuel et suivant, production, coût et lancement des travaux. */
function BuildingPlan({
  building,
  view,
  stock,
  error,
  onUpgrade,
  onClose,
}: {
  building: Building
  view: VillageView
  stock: Stock
  error: string | null
  onUpgrade: () => void
  onClose: () => void
}) {
  const level = view.levels[building]
  const { produces, perMinute } = CATALOG[building]
  const cost = view.nextCosts[building]
  return (
    <Blueprint
      side={sideOf(BUILDING_SPOTS[building].x)}
      kicker="Plan d'architecte"
      title={look(building).label}
      error={error}
      onClose={onClose}
    >
      <div className="blueprint-levels">
        <span className="plaque">{level === 0 ? 'À bâtir' : roman(level)}</span>
        {cost && (
          <>
            <span className="blueprint-arrow" aria-hidden="true">
              →
            </span>
            <span className="plaque plaque-next">{roman(level + 1)}</span>
          </>
        )}
      </div>
      <dl className="blueprint-notes">
        <dt>Production</dt>
        <dd>
          <GameIcon kind={produces} size={16} /> +{perMinute * level}
          {cost && <strong> → +{perMinute * (level + 1)}</strong>} / min
        </dd>
        {cost && (
          <>
            <dt>Matériaux</dt>
            <dd>
              <CostView cost={cost} stock={stock} />
            </dd>
          </>
        )}
      </dl>
      {cost ? (
        <button type="button" disabled={!canAfford(stock, cost)} onClick={onUpgrade}>
          {level === 0 ? 'Bâtir' : 'Lancer les travaux'}
        </button>
      ) : (
        <p className="blueprint-done">Niveau maximal atteint.</p>
      )}
    </Blueprint>
  )
}

/** Plan de l'hôtel de ville : organisation d'un festin, ou temps restant du festin en cours. */
function HallPlan({
  feast,
  stock,
  now,
  error,
  onFeast,
  onClose,
}: {
  feast: Feast | null
  stock: Stock
  now: number
  error: string | null
  onFeast: () => void
  onClose: () => void
}) {
  return (
    <Blueprint
      side="left"
      kicker="Hôtel de ville"
      title="Festin du village"
      error={error}
      onClose={onClose}
    >
      <dl className="blueprint-notes">
        <dt>Effet</dt>
        <dd>
          <strong>+{FEAST.bonus * 100} %</strong> de production pendant {FEAST.durationMs / 60_000}{' '}
          min
        </dd>
        {!feast && (
          <>
            <dt>Provisions</dt>
            <dd>
              <CostView cost={FEAST.cost} stock={stock} />
            </dd>
          </>
        )}
      </dl>
      {feast ? (
        <p className="blueprint-done">
          Festin en cours : encore {formatRemaining(feast.until - now)}.
        </p>
      ) : (
        <button type="button" disabled={!canAfford(stock, FEAST.cost)} onClick={onFeast}>
          Organiser un festin
        </button>
      )}
    </Blueprint>
  )
}

/** Écran du Village : fondation, stock et bâtiments, mis à jour en temps réel. */
export function VillageScreen({ userId }: { userId: string }) {
  // undefined : chargement en cours ; null : aucun village fondé.
  const [view, setView] = useState<VillageView | null | undefined>(undefined)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  // Bâtiment dont le panneau est ouvert, et bâtiment qui vient d'être amélioré (animation).
  const [selected, setSelected] = useState<Building | 'hall' | null>(null)
  const [bumped, setBumped] = useState<Building | null>(null)

  // REQUÊTE : lecture de la vue du village.
  const refresh = useCallback(async () => {
    const res = await client.village.$get()
    if (res.ok) setView((await res.json()).view)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // TEMPS RÉEL : chaque événement du village, y compris s'il provient d'un autre onglet
  // ou d'un autre appareil, provoque une relecture de la vue.
  const status = useChannel(villageChannel(userId), refresh)

  // Le stock est extrapolé localement deux fois par seconde, sans interroger le serveur.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [])

  // COMMANDES : chaque réponse contient la vue à jour, ou une erreur.
  async function found(name: string) {
    const res = await client.village.$post({ json: { name } })
    handle(await res.json())
  }
  async function upgrade(building: Building) {
    const res = await client.village.upgrade.$post({ json: { building } })
    if (handle(await res.json())) {
      // L'amélioration réussie est soulignée par une courte animation du bâtiment.
      setBumped(building)
      setTimeout(() => setBumped(null), 700)
    }
  }
  async function holdFeast() {
    const res = await client.village.feast.$post()
    handle(await res.json())
  }
  /** Applique une réponse de l'API ; renvoie vrai si la commande a réussi. */
  function handle(body: { view: VillageView } | { error: ApiError }) {
    if ('error' in body) {
      setError(ERRORS[body.error.code])
      return false
    }
    setError(null)
    setView(body.view)
    return true
  }
  function select(building: Building | 'hall' | null) {
    setError(null)
    setSelected((current) => (current === building ? null : building))
  }

  // Échap referme le plan, et ramène la caméra sur tout le village.
  useEffect(() => {
    if (!selected) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setSelected(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected])

  const title = (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <h1>
        <Entity kind="village" /> {view?.name ?? 'Royaumes'}
      </h1>
      <span className="status" data-status={status}>
        {STATUS_LABELS[status]}
      </span>
    </div>
  )

  // Chargement en cours.
  if (view === undefined) return title

  // Aucun village : formulaire de fondation.
  if (view === null) {
    return (
      <>
        {title}
        <div className="panel">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              found(String(new FormData(e.currentTarget).get('name')))
            }}
          >
            <label htmlFor="name">Nommez votre village</label>
            <input id="name" name="name" required minLength={2} maxLength={30} />
            <button type="submit">Fonder</button>
            {error && <p className="error">{error}</p>}
          </form>
        </div>
      </>
    )
  }

  // Village fondé : stock extrapolé à l'instant courant, puis scène et bâtiments.
  const stock = stockAt(view, now)
  // Le festin de la vue est terminé dès que l'heure locale dépasse sa fin.
  const feast = feastAt(view.feast, now)
  const boost = 1 + (feast?.bonus ?? 0)
  // Caméra : cadrage de l'élément sélectionné, ou vue d'ensemble.
  const camera = !selected
    ? undefined
    : selected === 'hall'
      ? cameraOn(HALL_SPOT.x, HALL_SPOT.y - 50, ZOOM.hall, 0.68)
      : cameraOn(
          BUILDING_SPOTS[selected].x,
          BUILDING_SPOTS[selected].y - 20,
          ZOOM.building,
          sideOf(BUILDING_SPOTS[selected].x) === 'right' ? 0.3 : 0.7,
        )
  return (
    <>
      {title}
      <section className="hud" aria-label="Ressources">
        {RESOURCES.map((r) => (
          <div key={r} className="hud-item">
            <GameIcon kind={r} size={28} />
            <div>
              <strong>{Math.floor(stock[r])}</strong>
              <small data-feast={!!feast}>+{view.ratesPerMinute[r] * boost} / min</small>
            </div>
          </div>
        ))}
      </section>

      {feast && (
        <p className="feast-banner" role="status">
          <GameIcon kind="feast" size={22} />
          <span>
            Festin en cours : production <strong>+{feast.bonus * 100} %</strong>, encore{' '}
            <strong>{formatRemaining(feast.until - now)}</strong>
          </span>
        </p>
      )}

      <section className="village-stage" aria-label="Bâtiments du village" data-zoomed={!!selected}>
        <div className="village-map" style={camera}>
          <VillageScene
            name={view.name}
            levels={view.levels}
            selected={selected}
            bumped={bumped}
            feasting={!!feast}
          />
          <button
            type="button"
            className="building-spot hall-spot"
            style={HALL_STYLE}
            aria-pressed={selected === 'hall'}
            aria-label={`Hôtel de ville${feast ? ', festin en cours' : ''}`}
            onClick={() => select('hall')}
          />
          {BUILDINGS.map((b) => {
            const level = view.levels[b]
            return (
              <button
                key={b}
                type="button"
                className="building-spot"
                style={spotOf(b)}
                aria-pressed={selected === b}
                aria-label={`${look(b).label}, ${level === 0 ? 'à bâtir' : `niveau ${level}`}`}
                onClick={() => select(b)}
              >
                {/* Plaque de pierre : nom du bâtiment, et niveau gravé en chiffres romains. */}
                <span className="spot-label" aria-hidden="true">
                  {look(b).label}
                  {level > 0 && <b>{roman(level)}</b>}
                </span>
              </button>
            )
          })}
        </div>
        {selected === 'hall' && (
          <HallPlan
            feast={feast}
            stock={stock}
            now={now}
            error={error}
            onFeast={holdFeast}
            onClose={() => select(null)}
          />
        )}
        {selected && selected !== 'hall' && (
          <BuildingPlan
            building={selected}
            view={view}
            stock={stock}
            error={error}
            onUpgrade={() => upgrade(selected)}
            onClose={() => select(null)}
          />
        )}
      </section>
      <p className="muted hint">
        Cliquez sur un bâtiment pour ouvrir son plan, ou sur l'hôtel de ville pour organiser un
        festin.
      </p>
    </>
  )
}
