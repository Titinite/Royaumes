import { Hono } from 'hono'
import type { AppEnv } from '@/platform/http/types'
import { validateParam } from '@/platform/http/validate'
import type { QuestsService } from './application/quests-service'
import { ClaimParams, type QuestError } from './contracts'

/** Code HTTP associé à chaque erreur métier. */
const STATUS: Record<QuestError['code'], 404 | 409> = {
  QUEST_NOT_FOUND: 404,
  QUEST_NOT_COMPLETED: 409,
  ALREADY_CLAIMED: 409,
  VILLAGE_REQUIRED: 409,
}

/**
 * Sous-application Hono du module Quêtes, montée sur /api/quests.
 * Le joueur est toujours celui que l'authentification a identifié : aucune route
 * n'accepte un identifiant de joueur dans la requête.
 */
export function createQuestsApi(service: QuestsService) {
  return (
    new Hono<AppEnv>()
      // Quêtes du jour du joueur connecté, avec leur progression.
      .get('/', async (c) => c.json({ board: await service.board(c.var.userId) }))

      // Joueurs qui ont obtenu le badge du jour, présentés dans la Taverne.
      .get('/champions', async (c) => c.json({ playerIds: await service.champions() }))

      // Réclamation de la récompense d'une quête du jour.
      .post('/:slot/claim', validateParam(ClaimParams), async (c) => {
        const result = await service.claim(c.var.userId, c.req.valid('param').slot)
        return result.ok
          ? c.json({ board: result.board })
          : c.json({ error: result.error }, STATUS[result.error.code])
      })
  )
}

export type QuestsApi = ReturnType<typeof createQuestsApi>
