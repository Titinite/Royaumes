/**
 * Entrée publique « serveur » du module Quêtes.
 * Avec contracts.ts et ui.tsx, c'est le seul fichier du module qui peut être
 * importé depuis l'extérieur.
 */
import type { Db } from '@/platform/db/client'
import type { ProjectionRunner } from '@/platform/projection/projection'
import { createQuestsApi } from './api'
import { createQuestsService } from './application/quests-service'
import { createDrizzleQuestRepository } from './infrastructure/drizzle-quest-repository'
import { createQuestsPersonalData } from './personal-data'

export interface QuestsModuleDeps {
  /** Base de données, dans laquelle le module tient ses tables. */
  db: Db
  /** Moteur des projections de la plateforme. */
  projections: ProjectionRunner
  /** Distribution de la boîte d'envoi, déclenchée après chaque réclamation. */
  dispatch: () => Promise<unknown>
  /** Horloge de référence ; l'heure réelle par défaut. */
  clock?: () => number
}

/** Fabrique du module : assemble l'adaptateur, le service, l'API et les données personnelles. */
export function createQuestsModule({ db, projections, dispatch, clock }: QuestsModuleDeps) {
  const repo = createDrizzleQuestRepository(db, projections)
  const service = createQuestsService(repo, { dispatch, clock })
  return {
    api: createQuestsApi(service),
    personalData: createQuestsPersonalData(db),
  }
}

export type { QuestsApi } from './api'
