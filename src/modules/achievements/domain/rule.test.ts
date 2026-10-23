import { describe, expect, it } from 'vitest'
import { ACHIEVEMENT_IDS, ACHIEVEMENTS } from './catalog'
import { achievementBoard, unlockedBy } from './rules'

describe('Hauts faits - catalogue', () => {
  it('propose douze hauts faits, aux seuils strictement positifs', () => {
    expect(ACHIEVEMENT_IDS).toHaveLength(12)
    for (const id of ACHIEVEMENT_IDS) expect(ACHIEVEMENTS[id].threshold).toBeGreaterThan(0)
  })
})

describe('Hauts faits - règle 1 : catalogue complet', () => {
  it('présente tous les hauts faits, débloqués ou non, à un joueur sans activité', () => {
    const board = achievementBoard({}, {})
    expect(board.total).toBe(12)
    expect(board.unlockedCount).toBe(0)
    expect(board.achievements.map((a) => a.id)).toEqual([...ACHIEVEMENT_IDS])
    expect(board.achievements.every((a) => a.progress === 0 && a.unlockedAt === null)).toBe(true)
  })

  it('présente la progression plafonnée au seuil, et la date des hauts faits débloqués', () => {
    const board = achievementBoard({ upgrades: 7 }, { 'builder-bronze': 1000 })
    const byId = Object.fromEntries(board.achievements.map((a) => [a.id, a]))
    expect(byId['builder-bronze']).toMatchObject({ progress: 5, unlockedAt: 1000 })
    expect(byId['builder-silver']).toMatchObject({ progress: 7, threshold: 15, unlockedAt: null })
    expect(board.unlockedCount).toBe(1)
  })
})

describe('Hauts faits - règle 3 : déblocage au seuil', () => {
  it('débloque un haut fait dès que sa métrique atteint le seuil', () => {
    expect(unlockedBy({ upgrades: 4 }, { upgrades: 5 })).toEqual(['builder-bronze'])
  })

  it("ne débloque rien tant que le seuil n'est pas atteint", () => {
    expect(unlockedBy({ upgrades: 3 }, { upgrades: 4 })).toEqual([])
  })
})

describe('Hauts faits - règle 4 : un seul déblocage', () => {
  it('ne débloque pas de nouveau un haut fait dont le seuil était déjà franchi', () => {
    expect(unlockedBy({ upgrades: 5 }, { upgrades: 6 })).toEqual([])
    expect(unlockedBy({ villagesFounded: 1 }, { villagesFounded: 2 })).toEqual([])
  })
})

describe('Hauts faits - règle 5 : plusieurs déblocages à la fois', () => {
  it('débloque tous les hauts faits dont le seuil est franchi par une même évolution', () => {
    expect(unlockedBy({ gamesPlayed: 0, gamesWon: 0 }, { gamesPlayed: 1, gamesWon: 1 })).toEqual([
      'adventurer',
      'slayer-bronze',
    ])
    // Une évolution importante peut franchir plusieurs paliers d'une même famille.
    expect(unlockedBy({ upgrades: 4 }, { upgrades: 15 })).toEqual([
      'builder-bronze',
      'builder-silver',
    ])
  })
})
