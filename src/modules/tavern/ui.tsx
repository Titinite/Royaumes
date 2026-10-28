'use client'
import { hc } from 'hono/client'
import { type FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { QuestBadge, useChampions } from '@/modules/quests/ui'
import { useChannel } from '@/platform/realtime/use-channel'
import { Entity } from '@/ui/entity'
import type { TavernApi } from './api'
import {
  HEARTBEAT_MS,
  MESSAGE_MAX_LENGTH,
  type MessageError,
  type PresentPlayer,
  TAVERN_CHANNEL,
  type TavernMessage,
} from './contracts'

/** Client HTTP typé, déduit de la sous-application Hono du module. */
const client = hc<TavernApi>('/api/tavern')

/** Libellé affiché pour chaque état de la connexion temps réel. */
const STATUS_LABELS = {
  connecting: 'Connexion...',
  open: 'Temps réel connecté',
  reconnecting: 'Reconnexion...',
} as const

/** Message affiché au joueur pour chaque erreur. */
function errorText(error: MessageError | { code: 'INVALID_INPUT' }): string {
  switch (error.code) {
    case 'EMPTY_MESSAGE':
      return 'Le message est vide.'
    case 'MESSAGE_TOO_LONG':
      return `Le message dépasse ${error.max} caractères.`
    case 'TOO_MANY_MESSAGES':
      return `Trop de messages : patientez ${Math.ceil(error.retryAfterMs / 1000)} secondes.`
    case 'INVALID_INPUT':
      return 'Saisie invalide.'
  }
}

/** Ajoute des messages à la liste, sans doublon, dans l'ordre de leurs identifiants. */
function merge(current: TavernMessage[], added: TavernMessage[]): TavernMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]))
  for (const message of added) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

/**
 * Départ en cours de transmission. Un signal de présence attend qu'il soit reçu : sans cela,
 * un joueur qui quitte la Taverne puis y revient aussitôt pourrait voir son départ arriver
 * au serveur après son nouveau signal, et disparaître de la liste des présents.
 */
let leaving: Promise<unknown> = Promise.resolve()

/** Signale le départ du joueur. L'option keepalive maintient la requête pendant la fermeture de l'onglet. */
function leave() {
  leaving = fetch('/api/tavern/presence/leave', { method: 'POST', keepalive: true }).catch(() => {})
}

/** Heure d'un message, au format local. */
const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** Délai sous lequel deux messages d'un même auteur sont regroupés sous un seul nom. */
const GROUP_MS = 5 * 60_000

/** Distance au bas de la liste, en pixels, sous laquelle le joueur est considéré « en bas ». */
const NEAR_BOTTOM_PX = 80

/** Teinte stable de l'avatar d'un joueur, déduite de son identifiant. */
function hueOf(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
}

/** Avatar d'un joueur : l'initiale de son nom, sur une couleur propre à ce joueur. */
function Avatar({ id, name }: { id: string; name: string }) {
  return (
    <span
      className="avatar"
      style={{ '--hue': hueOf(id) } as React.CSSProperties}
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

/** Écran de la Taverne : salon de discussion et joueurs présents. */
export function TavernScreen({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<TavernMessage[]>([])
  const [players, setPlayers] = useState<PresentPlayer[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Liste des messages, et nombre de messages arrivés pendant que le joueur lisait plus haut.
  const list = useRef<HTMLOListElement>(null)
  const atBottom = useRef(true)
  const [unread, setUnread] = useState(0)
  const lastId = useRef(0)

  // Joueurs qui ont accompli leurs quêtes du jour, relus à chaque nouveau message.
  const champions = useChampions(messages.length)

  // REQUÊTE : les derniers messages.
  const refresh = useCallback(async () => {
    const res = await client.messages.$get()
    if (!res.ok) return
    const latest = (await res.json()).messages
    setMessages((current) => merge(current, latest))
  }, [])

  // TEMPS RÉEL : chaque nouveau message est reçu avec son contenu, et ajouté à la liste.
  const status = useChannel(TAVERN_CHANNEL, (event) => {
    setMessages((current) => merge(current, [event.data as unknown as TavernMessage]))
  })

  // À chaque ouverture du canal, y compris après une reconnexion, l'historique est relu :
  // un message publié avant l'abonnement, ou pendant une interruption, n'est pas transmis
  // par le canal, qui ne diffuse que les messages à venir.
  useEffect(() => {
    if (status === 'open') refresh()
  }, [status, refresh])

  // PRÉSENCE : un signal immédiat, puis un signal régulier tant que la page est affichée.
  // Le départ est signalé lorsque le joueur quitte la page ou ferme l'onglet.
  useEffect(() => {
    const beat = async () => {
      await leaving
      const res = await client.presence.$post()
      if (res.ok) setPlayers((await res.json()).players)
    }
    beat()
    const timer = setInterval(beat, HEARTBEAT_MS)
    window.addEventListener('pagehide', leave)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [])

  // DÉFILEMENT : à l'arrivée d'un message, la liste descend jusqu'en bas si le joueur y était
  // déjà, ou si le message est le sien. S'il lisait plus haut, sa lecture n'est pas
  // interrompue : un bouton indique les nouveaux messages. useLayoutEffect défile avant
  // l'affichage, sans saut visible.
  useLayoutEffect(() => {
    const last = messages.at(-1)
    if (!last || last.id === lastId.current || !list.current) return
    const first = lastId.current === 0
    const added = messages.filter((m) => m.id > lastId.current).length
    lastId.current = last.id
    if (first || atBottom.current || last.authorId === userId) {
      list.current.scrollTo({ top: list.current.scrollHeight, behavior: first ? 'auto' : 'smooth' })
      setUnread(0)
    } else {
      setUnread((count) => count + added)
    }
  }, [messages, userId])

  function onScroll() {
    const el = list.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
    if (atBottom.current) setUnread(0)
  }

  function scrollToBottom() {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }

  // COMMANDE : publication d'un message.
  async function send(event: FormEvent) {
    event.preventDefault()
    const res = await client.messages.$post({ json: { body: draft } })
    const body = await res.json()
    if ('error' in body) {
      setError(errorText(body.error as MessageError))
    } else {
      setError(null)
      setDraft('')
      setMessages((current) => merge(current, [body.message]))
    }
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>
          <Entity kind="tavern" /> Taverne
        </h1>
        <span className="status" data-status={status}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="tavern">
        <section className="panel tavern-room" aria-label="Salle commune">
          <header className="tavern-head">
            <h2>Salle commune</h2>
            <small className="muted">Les derniers messages de tous les joueurs</small>
          </header>

          <div className="tavern-feed">
            {messages.length === 0 && (
              <p className="muted tavern-empty">
                Aucun message pour le moment : lancez la discussion !
              </p>
            )}
            <ol className="messages" ref={list} onScroll={onScroll} aria-live="polite">
              {messages.map((message, i) => {
                const previous = messages[i - 1]
                // Un message suit le précédent s'il est du même auteur, et envoyé peu après.
                const follows =
                  previous?.authorId === message.authorId &&
                  message.postedAt - previous.postedAt < GROUP_MS
                const mine = message.authorId === userId
                return (
                  <li
                    key={message.id}
                    data-mine={mine || undefined}
                    data-follows={follows || undefined}
                  >
                    {!mine && !follows && (
                      <Avatar id={message.authorId} name={message.authorName} />
                    )}
                    <div className="bubble">
                      {!follows && (
                        <div className="bubble-head">
                          <strong>{mine ? 'Vous' : message.authorName}</strong>
                          {champions.has(message.authorId) && <QuestBadge />}
                        </div>
                      )}
                      <p>{message.body}</p>
                      <time dateTime={new Date(message.postedAt).toISOString()}>
                        {timeOf(message.postedAt)}
                      </time>
                    </div>
                  </li>
                )
              })}
            </ol>
            {unread > 0 && (
              <button type="button" className="new-messages" onClick={scrollToBottom}>
                {unread} nouveau{unread > 1 ? 'x' : ''} message{unread > 1 ? 's' : ''} ↓
              </button>
            )}
          </div>

          <form className="composer" onSubmit={send}>
            <input
              aria-label="Votre message"
              value={draft}
              maxLength={MESSAGE_MAX_LENGTH * 2}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écrire à la Taverne…"
              autoComplete="off"
            />
            {draft.length > MESSAGE_MAX_LENGTH * 0.8 && (
              <small
                className="composer-count"
                data-over={draft.length > MESSAGE_MAX_LENGTH || undefined}
              >
                {draft.length} / {MESSAGE_MAX_LENGTH}
              </small>
            )}
            <button type="submit" disabled={draft.trim() === ''}>
              Envoyer
            </button>
          </form>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="panel tavern-presence" aria-label="Joueurs présents">
          <h2>
            Présents <span className="muted">({players.length})</span>
          </h2>
          <ul className="presence">
            {players.map((player) => (
              <li key={player.id}>
                <span className="presence-avatar">
                  <Avatar id={player.id} name={player.name} />
                  <span className="online-dot" aria-hidden="true" />
                </span>
                {player.name}
                {player.id === userId && <span className="muted"> (vous)</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
