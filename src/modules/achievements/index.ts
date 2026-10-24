/**
 * Entrée publique « serveur » du module Hauts faits.
 * Avec contracts.ts et ui.tsx, c'est le seul fichier du module qui peut être
 * importé depuis l'extérieur.
 */
import type { Db } from '@/platform/db/client'
import type { ProjectionRunner } from '@/platform/projection/projection'
import type { ChannelPolicy } from '@/platform/realtime/channel-policy'
import { createAchievementsApi } from './api'
import { createAchievementsService } from './application/achievements-service'
import {
  ACHIEVEMENT_UNLOCKED,
  ACHIEVEMENTS_CHANNEL_PREFIX,
  type AchievementUnlockedData,
  achievementsChannel,
} from './contracts'
import { createDrizzleAchievementRepository } from './infrastructure/drizzle-achievement-repository'
import { createAchievementsPersonalData } from './personal-data'

export interface AchievementsModuleDeps {
  /** Base de données, dans laquelle le module tient ses tables. */
  db: Db
  /** Moteur des projections de la plateforme. */
  projections: ProjectionRunner
}

/** Fabrique du module : assemble l'adaptateur, le service, l'API, le canal et les données personnelles. */
export function createAchievementsModule({ db, projections }: AchievementsModuleDeps) {
  const service = createAchievementsService(createDrizzleAchievementRepository(db, projections))
  const playerOf = (channel: string) => channel.slice(ACHIEVEMENTS_CHANNEL_PREFIX.length)

  // Canal des hauts faits : un canal par joueur, réservé à ce joueur. Il ne lit pas le journal,
  // mais la table des hauts faits débloqués, après avoir rattrapé la projection : un haut fait
  // débloqué par une action dans un autre module est ainsi annoncé sans autre lecture.
  // DETTE TECHNIQUE : chaque abonné déclenche ce rattrapage à chaque lecture du flux (DT-015).
  const channelPolicy: ChannelPolicy = {
    prefix: ACHIEVEMENTS_CHANNEL_PREFIX,
    canSubscribe: (channel, userId) => channel === achievementsChannel(userId),
    source: {
      async read(after, channel) {
        const fresh = await service.unlockedSince(playerOf(channel), after)
        return fresh.map(({ position, achievement, label, unlockedAt }) => ({
          position,
          stream: channel,
          version: position,
          type: ACHIEVEMENT_UNLOCKED,
          data: { achievement, label, unlockedAt } satisfies AchievementUnlockedData,
          occurredAt: new Date(unlockedAt),
        }))
      },
      // Un nouvel abonné ne reçoit que les déblocages à venir ; les précédents sont lus par l'API.
      start: (channel) => service.lastPosition(playerOf(channel)),
    },
  }

  return {
    api: createAchievementsApi(service),
    channelPolicy,
    personalData: createAchievementsPersonalData(db, projections),
  }
}

export type { AchievementsApi } from './api'
