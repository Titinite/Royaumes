'use client'
import { hc } from 'hono/client'
import { useEffect, useState } from 'react'
import { useChannel } from '@/platform/realtime/use-channel'
import { Entity } from '@/ui/entity'
import type { AchievementsApi } from './api'
import {
  type AchievementBoard,
  type AchievementUnlockedData,
  type AchievementView,
  achievementsChannel,
} from './contracts'

/** Client HTTP typé, déduit de la sous-application Hono du module. */
const client = hc<AchievementsApi>('/api/achievements')

/** Date d'obtention, au format local. */
const dateOf = (at: number) => new Date(at).toLocaleDateString('fr-FR')

/** Un haut fait : libellé, description, progression ou date d'obtention. */
function AchievementItem({ achievement }: { achievement: AchievementView }) {
  const done = achievement.unlockedAt !== null
  return (
    <li className="achievement" data-done={done || undefined}>
      <Entity kind={done ? 'achievements' : 'locked'} />
      <div>
        <strong>{achievement.label}</strong>
        <div className="muted">{achievement.description}</div>
        {done ? (
          <small className="ok">Obtenu le {dateOf(achievement.unlockedAt as number)}</small>
        ) : (
          <small className="muted">
            {achievement.progress} / {achievement.threshold}
          </small>
        )}
      </div>
    </li>
  )
}

/** Écran des Hauts faits : le catalogue complet, et la progression du joueur. */
export function AchievementsScreen() {
  // undefined : chargement en cours.
  const [board, setBoard] = useState<AchievementBoard | undefined>(undefined)

  // REQUÊTE : catalogue et progression du joueur connecté.
  useEffect(() => {
    client.index.$get().then(async (res) => {
      if (res.ok) setBoard((await res.json()).board)
    })
  }, [])

  return (
    <>
      <h1>
        <Entity kind="achievements" /> Hauts faits
      </h1>
      <p className="muted">
        Des distinctions permanentes, obtenues automatiquement en jouant.
        {board && ` ${board.unlockedCount} sur ${board.total} obtenus.`}
      </p>
      <section className="panel" aria-label="Hauts faits">
        {!board && <p className="muted">Chargement...</p>}
        {board && (
          <ul className="achievements">
            {board.achievements.map((achievement) => (
              <AchievementItem key={achievement.id} achievement={achievement} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

/** Durée d'affichage d'une notification, en millisecondes. */
const TOAST_MS = 6000

/**
 * Notifications des hauts faits débloqués, affichées quel que soit l'onglet ouvert.
 * TEMPS RÉEL : le canal du joueur annonce chaque haut fait au moment de son déblocage.
 */
export function AchievementToasts({ userId }: { userId: string }) {
  const [toasts, setToasts] = useState<(AchievementUnlockedData & { key: number })[]>([])

  useChannel(achievementsChannel(userId), (event) => {
    const toast = { ...(event.data as unknown as AchievementUnlockedData), key: event.position }
    setToasts((current) => [...current, toast])
    setTimeout(() => setToasts((current) => current.filter((t) => t.key !== toast.key)), TOAST_MS)
  })

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.key} className="toast" role="status">
          <Entity kind="achievements" /> Haut fait obtenu : <strong>{toast.label}</strong>
        </div>
      ))}
    </div>
  )
}
