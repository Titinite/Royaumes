import { zValidator } from '@hono/zod-validator'
import type { ZodType } from 'zod'

/**
 * Valide le corps JSON d'une requête à l'aide d'un schéma Zod.
 * En cas d'échec, renvoie une erreur 400 au format commun à toute l'API,
 * avec le message de la première anomalie détectée.
 */
export const validateJson = <T extends ZodType>(schema: T) =>
  zValidator('json', schema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Entrée invalide'
      return c.json({ error: { code: 'INVALID_INPUT' as const, message } }, 400)
    }
  })

/**
 * Valide les paramètres de chemin d'une requête (par exemple :slot) à l'aide d'un schéma
 * Zod, avec la même réponse d'erreur 400 que validateJson.
 */
export const validateParam = <T extends ZodType>(schema: T) =>
  zValidator('param', schema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Paramètre invalide'
      return c.json({ error: { code: 'INVALID_INPUT' as const, message } }, 400)
    }
  })
