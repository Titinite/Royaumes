import { REALM_TOPICS, type TransferRequest } from '@/modules/realm/contracts'
import type { QuestBoard } from '../contracts'
import {
  checkClaim,
  dayOf,
  firstKeptDay,
  hasBadge,
  type QuestError,
  questBoard,
  rewardTransferId,
} from '../domain/daily'
import type { QuestRepository } from './quest-repository'

export type ClaimResult = { ok: true; board: QuestBoard } | { ok: false; error: QuestError }

export interface QuestsServiceOptions {
  /** Distribution de la boîte d'envoi, déclenchée après chaque réclamation. */
  dispatch: () => Promise<unknown>
  /** Horloge de référence ; l'heure réelle par défaut. */
  clock?: () => number
}

/** Service applicatif des Quêtes. */
export function createQuestsService(
  repo: QuestRepository,
  { dispatch, clock = () => Date.now() }: QuestsServiceOptions,
) {
  /** Tableau des quêtes du jour d'un joueur, avec sa progression. */
  async function board(playerId: string): Promise<QuestBoard> {
    const day = dayOf(clock())
    const [counters, claimed] = await Promise.all([
      repo.counters(playerId, day),
      repo.claimed(playerId, day),
    ])
    const quests = questBoard(playerId, day, counters, claimed)
    return { day, quests, badge: hasBadge(quests) }
  }

  /**
   * Réclame la récompense d'une quête du jour. La réclamation et le message qui demande
   * au Village de verser les ressources sont enregistrés ensemble : la récompense est
   * versée au moins une fois, et le Village ignore un versement déjà reçu.
   */
  async function claim(playerId: string, slot: number): Promise<ClaimResult> {
    const current = await board(playerId)
    const checked = checkClaim(current.quests, slot, await repo.hasVillage(playerId))
    if (!checked.ok) return checked

    const { kind, reward } = checked.quest
    const request: TransferRequest = {
      transferId: rewardTransferId(playerId, current.day, kind),
      playerId,
      resources: reward,
    }
    const claimed = await repo.claim(
      { playerId, day: current.day, kind, claimedAt: clock() },
      { topic: REALM_TOPICS.deposit, payload: { ...request } },
    )
    // Une réclamation simultanée a été enregistrée entre la lecture et l'écriture (règle 7).
    if (!claimed) return { ok: false, error: { code: 'ALREADY_CLAIMED' } }

    await dispatch()
    return { ok: true, board: await board(playerId) }
  }

  /**
   * Joueurs qui ont obtenu le badge du jour (règle 9), présentés dans la Taverne.
   * DETTE TECHNIQUE : le badge est recalculé à chaque lecture pour tous les joueurs actifs
   * du jour, au lieu d'être enregistré lorsqu'il est obtenu (DT-012).
   */
  async function champions(): Promise<string[]> {
    const day = dayOf(clock())
    const all = await repo.countersOfDay(day)
    return [...all]
      .filter(([playerId, counters]) => hasBadge(questBoard(playerId, day, counters, [])))
      .map(([playerId]) => playerId)
  }

  /**
   * Tâche quotidienne : applique la durée de conservation, en supprimant la progression et
   * les réclamations des jours qui ne sont plus utiles. Renvoie le nombre de lignes supprimées.
   */
  const purge = () => repo.removeBefore(firstKeptDay(clock()))

  return { board, claim, champions, purge }
}

export type QuestsService = ReturnType<typeof createQuestsService>
