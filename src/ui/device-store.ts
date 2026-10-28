/**
 * Petites valeurs retenues par le navigateur du joueur (stockage local), pour le confort de
 * l'interface : menu replié, derniers éléments vus par les pastilles de notification (ADR 14).
 * Le stockage local peut être indisponible (navigation privée, stockage bloqué) : chaque
 * lecture et chaque écriture est protégée, et l'interface fonctionne sans lui.
 */

/** Préfixe commun à toutes les clés du jeu. */
const PREFIX = 'royaumes.'

/** Lit un nombre ; null s'il est absent ou illisible. */
export function readNumber(key: string): number | null {
  try {
    const value = localStorage.getItem(PREFIX + key)
    return value === null || Number.isNaN(Number(value)) ? null : Number(value)
  } catch {
    return null
  }
}

/** Enregistre un nombre ; sans effet si le stockage est indisponible. */
export function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(PREFIX + key, String(value))
  } catch {
    // La valeur ne sera simplement pas retenue.
  }
}

/** Supprime toutes les clés qui commencent par prefix, par exemple à la déconnexion. */
export function removeAll(prefix: string) {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX + prefix)) localStorage.removeItem(key)
    }
  } catch {
    // Rien à supprimer.
  }
}

/** Préfixe des marqueurs « déjà vu » des pastilles de notification. */
export const SEEN_PREFIX = 'vu.'

/** Clé du marqueur « déjà vu » d'une rubrique, propre à chaque joueur du navigateur. */
export const seenKey = (section: string, userId: string) => `${SEEN_PREFIX}${section}.${userId}`
