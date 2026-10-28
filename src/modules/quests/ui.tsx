'use client'
import { hc } from 'hono/client'
import { useCallback, useEffect, useState } from 'react'
import { Entity } from '@/ui/entity'
import type { QuestsApi } from './api'
import type { ChampionList, QuestBoard, QuestError, QuestView, Reward } from './contracts'

/** Client HTTP typé, déduit de la sous-application Hono du module. */
const client = hc<QuestsApi>('/api/quests')

/**
 * Signal émis par l'écran des Quêtes à chaque nouveau tableau (lecture, réclamation) :
 * la pastille du menu se met à jour aussitôt, sans attendre sa prochaine lecture.
 */
const boardChanged = new EventTarget()

/** Signale un nouveau tableau à la pastille du menu. */
const announce = (board: QuestBoard) =>
  boardChanged.dispatchEvent(new CustomEvent('change', { detail: board }))

/** Nombre de quêtes terminées dont la récompense n'a pas encore été réclamée. */
const claimableIn = (board: QuestBoard) =>
  board.quests.filter((quest) => quest.completed && !quest.claimed).length

/** Message affiché au joueur pour chaque erreur. */
const ERRORS: Record<QuestError['code'] | 'INVALID_INPUT', string> = {
  INVALID_INPUT: 'Quête invalide.',
  QUEST_NOT_FOUND: 'Cette quête ne fait pas partie de vos quêtes du jour.',
  QUEST_NOT_COMPLETED: "Cette quête n'est pas encore terminée.",
  ALREADY_CLAIMED: 'Récompense déjà réclamée.',
  VILLAGE_REQUIRED: 'Fondez votre village pour recevoir la récompense.',
}

/** Ressources d'une récompense, présentées par la couche de thème. */
function RewardView({ reward }: { reward: Reward }) {
  return (
    <span className="row" style={{ gap: 8 }}>
      {Object.entries(reward).map(([resource, amount]) => (
        <span key={resource}>
          <Entity kind={resource} /> {amount}
        </span>
      ))}
    </span>
  )
}

/** Une quête du jour : description, progression, récompense et bouton de réclamation. */
function QuestItem({ quest, onClaim }: { quest: QuestView; onClaim: (slot: number) => void }) {
  return (
    <li className="quest" data-done={quest.completed || undefined}>
      <div>
        <strong>{quest.label}</strong>
        <div className="muted">{quest.description}</div>
        <progress
          value={quest.progress}
          max={quest.goal}
          aria-label={`Progression : ${quest.label}`}
        />
        <small className="muted">
          {' '}
          {quest.progress} / {quest.goal}
        </small>
      </div>
      <div className="row">
        <RewardView reward={quest.reward} />
        {quest.claimed ? (
          <span className="ok">Récompense reçue</span>
        ) : (
          <button type="button" disabled={!quest.completed} onClick={() => onClaim(quest.slot)}>
            Réclamer
          </button>
        )}
      </div>
    </li>
  )
}

/** Écran des Quêtes : les quatre quêtes du jour du joueur, et leurs récompenses. */
export function QuestsScreen() {
  // undefined : chargement en cours.
  const [board, setBoard] = useState<QuestBoard | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  // REQUÊTE : tableau des quêtes du jour.
  const refresh = useCallback(async () => {
    const res = await client.index.$get()
    if (!res.ok) return
    const next = (await res.json()).board
    setBoard(next)
    announce(next)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // COMMANDE : réclamation d'une récompense ; la réponse contient le tableau à jour.
  async function claim(slot: number) {
    const res = await client[':slot'].claim.$post({ param: { slot: String(slot) } })
    const body = await res.json()
    if ('error' in body) {
      setError(ERRORS[(body.error as { code: keyof typeof ERRORS }).code])
    } else {
      setError(null)
      setBoard(body.board)
      announce(body.board)
    }
  }

  return (
    <>
      <h1>
        <Entity kind="quests" /> Quêtes du jour
      </h1>
      <p className="muted">
        Quatre nouvelles quêtes chaque jour, réalisées par vos actions dans le Village, le Donjon et
        le Marché.
      </p>

      {board?.badge && (
        <p className="panel ok" role="status">
          <Entity kind="badge" /> Vous avez accompli vos quêtes du jour : votre badge est visible
          dans la Taverne.
        </p>
      )}

      <section className="panel" aria-label="Quêtes du jour">
        {!board && <p className="muted">Chargement...</p>}
        {board && (
          <ul className="quests">
            {board.quests.map((quest) => (
              <QuestItem key={quest.kind} quest={quest} onClaim={claim} />
            ))}
          </ul>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </>
  )
}

/**
 * Joueurs qui ont obtenu le badge du jour. Utilisé par la Taverne, qui affiche le badge
 * à côté de leur nom ; la liste est relue à chaque changement de dépendance.
 */
export function useChampions(refreshKey: unknown): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    // La clé ne sert qu'à déclencher une nouvelle lecture.
    void refreshKey
    fetch('/api/quests/champions')
      .then((res) => (res.ok ? (res.json() as Promise<ChampionList>) : { playerIds: [] }))
      .then((list) => setIds(new Set(list.playerIds)))
      .catch(() => {})
  }, [refreshKey])
  return ids
}

/** Badge « Quêtes du jour accomplies », affiché à côté du nom d'un joueur. */
export function QuestBadge() {
  return <Entity kind="badge" />
}

/** Intervalle de relecture des quêtes pour la pastille du menu, en millisecondes. */
const NOTIFY_POLL_MS = 30_000

/**
 * Pastille du menu : nombre de quêtes terminées à réclamer. Une quête se termine par une action
 * faite dans un autre module : le tableau est relu à chaque changement de page (refreshKey), au
 * retour sur l'onglet, et toutes les 30 secondes. La pastille disparaît quand la récompense est
 * réclamée : aucun « déjà vu » n'est donc nécessaire (ADR 14).
 */
export function useQuestNotifications(refreshKey: unknown): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    void refreshKey
    let active = true
    const read = async () => {
      const res = await client.index.$get().catch(() => null)
      if (active && res?.ok) setCount(claimableIn((await res.json()).board))
    }
    const onChange = (event: Event) =>
      setCount(claimableIn((event as CustomEvent<QuestBoard>).detail))
    read()
    const timer = setInterval(read, NOTIFY_POLL_MS)
    window.addEventListener('focus', read)
    boardChanged.addEventListener('change', onChange)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', read)
      boardChanged.removeEventListener('change', onChange)
    }
  }, [refreshKey])

  return count
}
