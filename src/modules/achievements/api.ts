import { Hono } from 'hono'
import type { AppEnv } from '@/platform/http/types'
import type { AchievementsService } from './application/achievements-service'

/**
 * Sous-application Hono du module Hauts faits, montée sur /api/achievements.
 * Le joueur est toujours celui que l'authentification a identifié : un joueur ne consulte
 * que ses propres hauts faits (règle 7).
 */
export function createAchievementsApi(service: AchievementsService) {
  return new Hono<AppEnv>().get('/', async (c) =>
    c.json({ board: await service.board(c.var.userId) }),
  )
}

export type AchievementsApi = ReturnType<typeof createAchievementsApi>
