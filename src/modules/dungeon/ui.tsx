'use client'
import { hc } from 'hono/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useChannel } from '@/platform/realtime/use-channel'
import { Entity } from '@/ui/entity'
import { GameIcon } from '@/ui/game-icon'
import { useCountdown } from '@/ui/use-countdown'
import type { DungeonApi } from './api'
import {
  ActionHand,
  Candle,
  type CardKind,
  Corridor,
  HeroCard,
  MonsterFighter,
  useRoundReplay,
  useTorchlight,
} from './arena'
import {
  type Action,
  DIFFICULTIES,
  type Difficulty,
  type Effect,
  EXPLORE_MS,
  type GameError,
  type GameView,
  gameChannel,
  MAX_HEROES,
  MONSTERS,
  type Monster,
  type OpenGame,
  ROUND_MS,
} from './contracts'

/** Client HTTP typé, déduit de la sous-application Hono du module. */
const client = hc<DungeonApi>('/api/dungeon')

/** Erreurs que l'API peut renvoyer : erreurs métier et erreur de validation. */
type ApiError = { code: GameError['code'] | 'INVALID_INPUT'; message?: string }

/** Message affiché au joueur pour chaque erreur. */
const ERRORS: Record<ApiError['code'], string> = {
  INVALID_INPUT: 'Saisie invalide.',
  GAME_NOT_FOUND: 'Expédition introuvable.',
  ALREADY_EXISTS: 'Expédition déjà ouverte.',
  WRONG_PHASE: "Cette action n'est plus possible.",
  GAME_FULL: "L'expédition est complète.",
  ALREADY_JOINED: "Vous faites déjà partie de l'expédition.",
  NOT_A_MEMBER: "Vous ne faites pas partie de l'expédition.",
  NOT_HOST: "Seul l'hôte peut lancer l'expédition.",
  NOT_YOUR_TURN: "Ce n'est pas votre tour.",
  HERO_DOWN: 'Votre héros est tombé.',
  ROUND_OVER: 'La manche est déjà terminée.',
  ALREADY_CHOSEN: 'Vous avez déjà choisi votre action.',
  INVALID_TARGET: 'Cible invalide.',
}

/** Libellé de chaque niveau de difficulté. */
const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Facile', hard: 'Difficile' }

/** Libellé affiché pour chaque état de la connexion temps réel. */
const STATUS_LABELS = {
  connecting: 'Connexion...',
  open: 'Temps réel connecté',
  reconnecting: 'Reconnexion...',
} as const

// ---------------------------------------------------------------------------
// Liste des expéditions ouvertes
// ---------------------------------------------------------------------------

/** Écran d'accueil du Donjon : expéditions ouvertes et ouverture d'une expédition. */
export function DungeonLobby() {
  const router = useRouter()
  const [games, setGames] = useState<OpenGame[] | undefined>(undefined)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')

  const refresh = useCallback(async () => {
    const res = await client.games.$get()
    if (res.ok) setGames((await res.json()).games)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function open() {
    const res = await client.games.$post({ json: { difficulty } })
    if (res.ok) router.push(`/dungeon/${(await res.json()).gameId}`)
  }

  return (
    <>
      <h1>
        <Entity kind="dungeon" /> Donjon
      </h1>
      <div className="panel row">
        <label htmlFor="difficulty">Niveau</label>
        <select
          id="difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
        >
          {DIFFICULTIES.map((level) => (
            <option key={level} value={level}>
              {DIFFICULTY_LABELS[level]}
            </option>
          ))}
        </select>
        <button type="button" onClick={open}>
          Ouvrir une nouvelle expédition
        </button>
      </div>
      <section className="panel" aria-label="Expéditions ouvertes">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Expéditions ouvertes</h2>
          <button className="link" type="button" onClick={refresh}>
            Actualiser
          </button>
        </div>
        {games?.length === 0 && <p className="muted">Aucune expédition ouverte pour le moment.</p>}
        <ul className="games">
          {games?.map((game) => (
            <li key={game.gameId}>
              <span>
                Expédition de {game.hostName}{' '}
                <span className="muted">
                  ({game.heroCount}/{MAX_HEROES} héros)
                </span>
              </span>
              <Link href={`/dungeon/${game.gameId}`}>Voir</Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

// ---------------------------------------------------------------------------
// Expédition
// ---------------------------------------------------------------------------

/** Nom affiché d'un monstre, numéroté si la salle en contient plusieurs du même type. */
function monsterName(monster: Monster, monsters: Monster[]) {
  const sameKind = monsters.filter((other) => other.kind === monster.kind)
  const name = MONSTERS[monster.kind].name
  return sameKind.length > 1 ? `${name} ${sameKind.indexOf(monster) + 1}` : name
}

/** Description d'une action, telle que le joueur l'a choisie. */
function describeAction(action: Action, nameOf: (id: string) => string) {
  if (action.type === 'attack') return `attaquer ${nameOf(action.target)}`
  if (action.type === 'heal') return `soigner ${nameOf(action.target)}`
  return 'se défendre'
}

/** Préposition « de » devant un verbe à l'infinitif, élidée devant une voyelle. */
const ofVerb = (text: string) => (/^[aeéiou]/i.test(text) ? `d'${text}` : `de ${text}`)

/** Description d'un effet de la dernière manche. */
function describeEffect(effect: Effect, nameOf: (id: string) => string) {
  return effect.kind === 'damage'
    ? `${nameOf(effect.source)} inflige ${effect.amount} dégâts à ${nameOf(effect.target)}`
    : `${nameOf(effect.source)} rend ${effect.amount} points de vie à ${nameOf(effect.target)}`
}

/** Écran d'une expédition : salon, exploration, combat et fin de l'expédition. */
export function DungeonGame({ gameId, userId }: { gameId: string; userId: string }) {
  // undefined : chargement en cours ; null : expédition introuvable.
  const [view, setView] = useState<GameView | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  // Carte d'action choisie, en attente de sa cible (attaque ou soin).
  const [card, setCard] = useState<CardKind | null>(null)
  const torch = useTorchlight()
  const replay = useRoundReplay(view?.lastRound)
  const param = { id: gameId }

  // REQUÊTE : lecture de la vue de l'expédition, filtrée pour le joueur.
  const refresh = useCallback(async () => {
    const res = await client.games[':id'].$get({ param: { id: gameId } })
    if (res.ok) setView((await res.json()).view)
    else if (res.status === 404) setView(null)
  }, [gameId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // TEMPS RÉEL : seuls les membres écoutent le canal de l'expédition. Le canal ne transmet
  // aucune donnée : chaque notification provoque une relecture de la vue filtrée.
  const status = useChannel(view?.isMember ? gameChannel(gameId) : null, refresh)

  // COMMANDES : chaque réponse contient la vue à jour, ou une erreur.
  function handle(body: { view: GameView } | { error: ApiError }) {
    if ('error' in body) {
      setError(ERRORS[body.error.code])
      refresh()
    } else {
      setError(null)
      setView(body.view)
    }
  }
  const addCompanion = async () =>
    handle(await (await client.games[':id'].companion.$post({ param })).json())
  const join = async () => handle(await (await client.games[':id'].join.$post({ param })).json())
  const start = async () => handle(await (await client.games[':id'].start.$post({ param })).json())
  const openDoor = async () =>
    handle(await (await client.games[':id'].door.$post({ param })).json())
  async function act(action: Action) {
    if (!view) return
    setCard(null)
    const res = await client.games[':id'].action.$post({
      param,
      json: { round: view.round, action },
    })
    handle(await res.json())
  }

  // ÉCHÉANCE : lorsque le compte à rebours d'une manche ou d'un tour d'exploration atteint
  // zéro, la commande d'échéance fait enregistrer la suite de l'expédition, et donc
  // notifier tous les membres.
  const checkDeadline = useCallback(async () => {
    const res = await client.games[':id'].deadline.$post({ param: { id: gameId } })
    if (res.ok) setView((await res.json()).view)
  }, [gameId])
  const remaining = useCountdown(
    view?.isMember && (view.phase === 'combat' || view.phase === 'exploring')
      ? view.deadline
      : null,
    checkDeadline,
  )

  const title = (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <h1>
        <Entity kind="dungeon" /> Expédition
        {view && <span className="muted"> - {DIFFICULTY_LABELS[view.difficulty]}</span>}
      </h1>
      {view?.isMember && (
        <span className="status" data-status={status}>
          {STATUS_LABELS[status]}
        </span>
      )}
    </div>
  )

  if (view === undefined) return title
  if (view === null) {
    return (
      <>
        {title}
        <p className="error">{ERRORS.GAME_NOT_FOUND}</p>
        <Link href="/dungeon">Retour au Donjon</Link>
      </>
    )
  }

  // Noms des combattants, pour décrire les actions et les effets.
  const nameOf = (id: string) => {
    const hero = view.heroes.find((h) => h.id === id)
    if (hero) return hero.name
    const monster = view.monsters.find((m) => m.id === id)
    return monster ? monsterName(monster, view.monsters) : id
  }
  const me = view.heroes.find((hero) => hero.id === userId)
  const canAct = view.phase === 'combat' && !!me && me.hp > 0 && !me.action
  const inArena = view.phase !== 'lobby'

  /** Choix d'une carte : la défense est jouée aussitôt, l'attaque et le soin attendent une cible. */
  function pick(kind: CardKind) {
    if (kind === 'defend') act({ type: 'defend' })
    else setCard((current) => (current === kind ? null : kind))
  }

  return (
    <>
      {title}
      <Corridor room={view.room} roomCount={view.roomCount} />

      {/* Salon : héros réunis, rejoindre ou lancer l'expédition. */}
      {view.phase === 'lobby' && (
        <section className="panel lobby" aria-label="Salon de l'expédition">
          <div className="lobby-heroes">
            {view.heroes.map((hero) => (
              <HeroCard
                key={hero.id}
                hero={hero}
                me={hero.id === userId}
                turn={false}
                targetable={false}
                effect={null}
                onTarget={() => {}}
              />
            ))}
          </div>
          <p className="muted">
            Communiquez l'adresse de cette page aux joueurs que vous souhaitez inviter.
          </p>
          <div className="row">
            {!view.isMember && view.heroes.length < MAX_HEROES && (
              <button type="button" onClick={join}>
                Rejoindre l'expédition
              </button>
            )}
            {view.isHost && view.heroes.length < MAX_HEROES && (
              <button type="button" onClick={addCompanion}>
                <GameIcon kind="companion" size={18} /> Ajouter un compagnon
              </button>
            )}
            {view.isHost && (
              <button type="button" onClick={start}>
                Entrer dans le donjon
              </button>
            )}
          </div>
          {view.isMember && !view.isHost && (
            <p className="muted">En attente du lancement par l'hôte.</p>
          )}
        </section>
      )}

      {/* Arène : exploration, combat et fin de l'expédition, à la lueur de la torche. */}
      {inArena && (
        <section
          ref={torch.ref}
          onPointerMove={torch.onPointerMove}
          className="arena"
          data-phase={view.phase}
          aria-label="Arène"
        >
          <div className="arena-light" aria-hidden="true" />

          {/* L'indication garde sa place même vide : l'arène ne saute pas quand elle change. */}
          {view.phase === 'combat' && (
            <p className="arena-hint" role="status" data-visible={card !== null}>
              {card === 'attack' && 'Choisis le monstre à attaquer'}
              {card === 'heal' && 'Choisis le héros à soigner'}
            </p>
          )}

          <div className="arena-stage">
            {view.phase === 'combat' &&
              view.monsters.map((monster) => (
                <MonsterFighter
                  key={monster.id}
                  monster={monster}
                  name={monsterName(monster, view.monsters)}
                  targetable={canAct && card === 'attack' && monster.hp > 0}
                  effect={replay}
                  onTarget={() => act({ type: 'attack', target: monster.id })}
                />
              ))}

            {view.phase === 'exploring' && (
              <div className="room-scene">
                {view.currentRoom?.kind === 'treasure' && (
                  <p className="room-event">
                    <GameIcon kind="treasure" size={64} />
                    <span>Un trésor : +{view.currentRoom.gold} or</span>
                  </p>
                )}
                {view.currentRoom?.kind === 'empty' && (
                  <p className="room-event muted">Une salle vide, silencieuse.</p>
                )}
                {view.room < 0 && <p className="room-event muted">L'entrée du donjon.</p>}
                {view.turnHeroId === userId ? (
                  <button type="button" className="door-button" onClick={openDoor}>
                    <GameIcon kind={view.room === view.roomCount - 2 ? 'boss' : 'door'} size={72} />
                    <span>Ouvrir la porte suivante</span>
                  </button>
                ) : (
                  <p className="muted">Au tour de {nameOf(view.turnHeroId ?? '')}.</p>
                )}
                <p className="muted">
                  Butin : <GameIcon kind="gold" size={16} /> {view.loot}
                </p>
              </div>
            )}

            {(view.phase === 'won' || view.phase === 'lost') && (
              <div className="room-scene ending" data-won={view.phase === 'won'}>
                <GameIcon kind={view.phase === 'won' ? 'treasure' : 'boss'} size={88} />
                <h2>{view.phase === 'won' ? 'Victoire !' : 'Défaite...'}</h2>
                <p>
                  Butin de l'expédition : <GameIcon kind="gold" size={18} /> {view.loot}
                </p>
                <Link href="/dungeon">Retour au Donjon</Link>
              </div>
            )}
          </div>

          {remaining !== null && (view.phase === 'combat' || view.phase === 'exploring') && (
            <Candle
              remaining={remaining}
              total={(view.phase === 'combat' ? ROUND_MS : EXPLORE_MS) / 1000}
            />
          )}

          <div className="arena-heroes">
            {view.heroes.map((hero) => (
              <HeroCard
                key={hero.id}
                hero={hero}
                me={hero.id === userId}
                turn={view.turnHeroId === hero.id}
                targetable={canAct && card === 'heal' && hero.hp > 0}
                effect={replay}
                onTarget={() => act({ type: 'heal', target: hero.id })}
              />
            ))}
          </div>

          {view.phase === 'combat' && (
            <div className="arena-actions">
              {canAct && <ActionHand selected={card} onPick={pick} />}
              {me?.action && (
                <p className="chosen">
                  Votre choix : {describeAction(me.action, nameOf)}. En attente des autres héros.
                </p>
              )}
              {me && me.hp <= 0 && <p className="chosen">Votre héros est tombé.</p>}
            </div>
          )}
        </section>
      )}

      {/* Résultat de la dernière manche, en texte : il complète le rejeu animé. */}
      {view.lastRound && (
        <details className="panel round-log">
          <summary>Journal de la manche {view.lastRound.round}</summary>
          <ul className="log">
            {Object.entries(view.lastRound.actions).map(([heroId, action]) => (
              <li key={heroId}>
                {nameOf(heroId)} a choisi {ofVerb(describeAction(action, nameOf))}.
              </li>
            ))}
            {view.lastRound.effects.map((effect) => (
              // Chaque combattant n'agit qu'une fois par manche : ce triplet identifie l'effet.
              <li key={`${effect.kind}-${effect.source}-${effect.target}`}>
                {describeEffect(effect, nameOf)}.
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
