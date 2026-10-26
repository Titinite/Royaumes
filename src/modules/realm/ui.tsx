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
  MAX_LEVEL,
  RESOURCES,
  type Stock,
  stockAt,
  type VillageView,
  villageChannel,
} from './contracts'
import { BUILDING_SPOTS, SCENE, VillageScene } from './village-scene'

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

/** Coût d'une amélioration, présenté par les icônes des ressources. */
function CostView({ cost }: { cost: Partial<Stock> }) {
  return (
    <span className="cost">
      {Object.entries(cost).map(([r, n]) => (
        <span key={r}>
          <GameIcon kind={r} size={18} /> {n}
        </span>
      ))}
    </span>
  )
}

/** Panneau d'un bâtiment sélectionné : niveau, production, coût et amélioration. */
function BuildingPanel({
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
  // Le panneau est placé du côté de la scène opposé au bâtiment, pour ne pas le masquer.
  const side = BUILDING_SPOTS[building].x < SCENE.width / 2 ? 'right' : 'left'
  return (
    <section className="building-panel" data-side={side} aria-label={look(building).label}>
      <button type="button" className="link close" onClick={onClose} aria-label="Fermer">
        ×
      </button>
      <h3>{look(building).label}</h3>
      <div className="muted">
        {level === 0 ? 'À bâtir' : `Niveau ${level}`}
        {level < MAX_LEVEL && ` → ${level + 1}`}
      </div>
      <div className="panel-row">
        <span>Production</span>
        <span>
          <GameIcon kind={produces} size={18} /> <strong>+{perMinute * level}</strong>
          {level < MAX_LEVEL && ` → +${perMinute * (level + 1)}`} / min
        </span>
      </div>
      {cost ? (
        <>
          <div className="panel-row">
            <span>Coût</span>
            <CostView cost={cost} />
          </div>
          <button type="button" disabled={!canAfford(stock, cost)} onClick={onUpgrade}>
            {level === 0 ? 'Construire' : 'Améliorer'}
          </button>
        </>
      ) : (
        <p className="ok">Niveau maximal atteint.</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

/** Écran du Village : fondation, stock et bâtiments, mis à jour en temps réel. */
export function VillageScreen({ userId }: { userId: string }) {
  // undefined : chargement en cours ; null : aucun village fondé.
  const [view, setView] = useState<VillageView | null | undefined>(undefined)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  // Bâtiment dont le panneau est ouvert, et bâtiment qui vient d'être amélioré (animation).
  const [selected, setSelected] = useState<Building | null>(null)
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
  function select(building: Building | null) {
    setError(null)
    setSelected((current) => (current === building ? null : building))
  }

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
  return (
    <>
      {title}
      <section className="hud" aria-label="Ressources">
        {RESOURCES.map((r) => (
          <div key={r} className="hud-item">
            <GameIcon kind={r} size={28} />
            <div>
              <strong>{Math.floor(stock[r])}</strong>
              <small>+{view.ratesPerMinute[r]} / min</small>
            </div>
          </div>
        ))}
      </section>

      <section className="village-stage" aria-label="Bâtiments du village">
        <div className="village-map">
          <VillageScene name={view.name} levels={view.levels} selected={selected} bumped={bumped} />
          {BUILDINGS.map((b) => {
            const level = view.levels[b]
            const producing = level > 0
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
                {producing && (
                  <span className="spot-gain" aria-hidden="true">
                    +{CATALOG[b].perMinute * level}{' '}
                    <GameIcon kind={CATALOG[b].produces} size={14} />
                  </span>
                )}
                {producing && (
                  <span className="spot-level" aria-hidden="true">
                    {level}
                  </span>
                )}
                <span className="spot-label" aria-hidden="true">
                  {look(b).label}
                </span>
              </button>
            )
          })}
        </div>
        {selected && (
          <BuildingPanel
            building={selected}
            view={view}
            stock={stock}
            error={error}
            onUpgrade={() => upgrade(selected)}
            onClose={() => select(null)}
          />
        )}
      </section>
      <p className="muted hint">Cliquez sur un bâtiment pour l'améliorer.</p>
    </>
  )
}
