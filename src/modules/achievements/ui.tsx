'use client'
import { hc } from 'hono/client'
import { useEffect, useState } from 'react'
import { useChannel } from '@/platform/realtime/use-channel'
import { readNumber, seenKey, writeNumber } from '@/ui/device-store'
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

/** Notification affichée pour un haut fait débloqué. */
export type AchievementToast = AchievementUnlockedData & { key: number }

/**
 * Notifications des hauts faits, affichées quel que soit l'onglet ouvert : les notifications
 * éphémères (toasts) et le nombre de hauts faits pas encore vus, pour la pastille du menu.
 * TEMPS RÉEL : un seul abonnement au canal du joueur sert aux deux.
 * « Déjà vu » : la date du dernier haut fait vu est retenue par le navigateur (ADR 14) ; elle
 * avance lorsque le joueur ouvre l'écran des Hauts faits (viewing).
 */
export function useAchievementNotifications(userId: string, viewing: boolean) {
  const [toasts, setToasts] = useState<AchievementToast[]>([])
  // Dates d'obtention des hauts faits connus, et date du dernier haut fait vu.
  const [unlocked, setUnlocked] = useState<number[]>([])
  const [seen, setSeen] = useState<number | null>(null)
  const key = seenKey('hauts-faits', userId)

  // Lecture initiale. Sans marqueur (premier passage sur ce navigateur), les hauts faits déjà
  // obtenus sont considérés comme vus : seuls les suivants sont signalés.
  useEffect(() => {
    client.index.$get().then(async (res) => {
      if (!res.ok) return
      const dates = (await res.json()).board.achievements.flatMap((a) =>
        a.unlockedAt === null ? [] : [a.unlockedAt],
      )
      let marker = readNumber(key)
      if (marker === null) {
        marker = Math.max(0, ...dates)
        writeNumber(key, marker)
      }
      // Union avec les hauts faits déjà reçus par le canal, si la lecture arrive après eux.
      setUnlocked((current) => [...new Set([...current, ...dates])])
      setSeen(marker)
    })
  }, [key])

  useChannel(achievementsChannel(userId), (event) => {
    const toast = { ...(event.data as unknown as AchievementUnlockedData), key: event.position }
    setToasts((current) => [...current, toast])
    setUnlocked((current) => [...current, toast.unlockedAt])
    setTimeout(() => setToasts((current) => current.filter((t) => t.key !== toast.key)), TOAST_MS)
  })

  // Écran des Hauts faits ouvert : tous les hauts faits connus deviennent vus.
  useEffect(() => {
    if (!viewing || unlocked.length === 0) return
    const latest = Math.max(...unlocked)
    if (seen === null || latest > seen) {
      writeNumber(key, latest)
      setSeen(latest)
    }
  }, [viewing, unlocked, seen, key])

  const count = seen === null || viewing ? 0 : unlocked.filter((at) => at > seen).length
  return { count, toasts }
}

/** Notifications éphémères des hauts faits débloqués, fournies par useAchievementNotifications. */
export function AchievementToasts({ toasts }: { toasts: AchievementToast[] }) {
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
