import { describe, expect, it } from 'vitest'
import { QUEST_KINDS, QUESTS, QUESTS_PER_DAY, type QuestKind } from './catalog'
import { checkClaim, dailyQuests, dayOf, hasBadge, questBoard, rewardTransferId } from './daily'

const DAY = '2026-10-23'
const PLAYER = 'joueur-1'

/** Compteurs qui terminent toutes les quêtes du catalogue. */
const ALL_DONE = {
  upgrades: 9,
  gamesPlayed: 9,
  gamesWon: 9,
  gamesJoined: 9,
  offersPublished: 9,
  purchases: 9,
}

/** Premier joueur dont les quêtes du jour comprennent la quête demandée. */
function playerWith(kind: QuestKind) {
  for (let i = 0; ; i++) if (dailyQuests(`joueur-${i}`, DAY).includes(kind)) return `joueur-${i}`
}

/** Jours successifs à partir du 1er janvier 2026. */
const days = (n: number) =>
  Array.from({ length: n }, (_, i) => dayOf(Date.UTC(2026, 0, 1) + i * 86_400_000))

describe('Quêtes - catalogue', () => {
  it('propose plus de types de quêtes que de quêtes par jour, avec des objectifs positifs', () => {
    expect(QUEST_KINDS.length).toBeGreaterThan(QUESTS_PER_DAY)
    for (const kind of QUEST_KINDS) {
      expect(QUESTS[kind].goal).toBeGreaterThan(0)
      expect(Object.keys(QUESTS[kind].reward).length).toBeGreaterThan(0)
    }
  })
})

describe('Quêtes - règle 1 : quatre quêtes distinctes par jour', () => {
  it('tire chaque jour quatre quêtes distinctes du catalogue', () => {
    for (const day of days(60)) {
      const quests = dailyQuests(PLAYER, day)
      expect(quests).toHaveLength(QUESTS_PER_DAY)
      expect(new Set(quests).size).toBe(QUESTS_PER_DAY)
      for (const kind of quests) expect(QUEST_KINDS).toContain(kind)
    }
  })

  it('finit par proposer chaque type de quête du catalogue', () => {
    const seen = new Set(days(60).flatMap((day) => dailyQuests(PLAYER, day)))
    expect(seen.size).toBe(QUEST_KINDS.length)
  })
})

describe('Quêtes - règle 2 : tirage déterministe', () => {
  it('donne toujours les mêmes quêtes pour un même joueur et un même jour', () => {
    expect(dailyQuests(PLAYER, DAY)).toEqual(dailyQuests(PLAYER, DAY))
  })

  it("change les quêtes d'un jour à l'autre, et d'un joueur à l'autre", () => {
    const byDay = new Set(days(30).map((day) => dailyQuests(PLAYER, day).join()))
    expect(byDay.size).toBeGreaterThan(1)
    const byPlayer = new Set(
      Array.from({ length: 30 }, (_, i) => dailyQuests(`joueur-${i}`, DAY).join()),
    )
    expect(byPlayer.size).toBeGreaterThan(1)
  })
})

describe('Quêtes - règle 3 : changement de jour à minuit (UTC)', () => {
  it('rattache un instant à son jour, et change de jour à minuit UTC', () => {
    expect(dayOf(Date.UTC(2026, 9, 23, 23, 59, 59, 999))).toBe('2026-10-23')
    expect(dayOf(Date.UTC(2026, 9, 24, 0, 0, 0, 0))).toBe('2026-10-24')
  })

  it("ne tient compte que des compteurs du jour : sans action ce jour, rien n'est terminé", () => {
    const board = questBoard(PLAYER, DAY, {}, [])
    expect(board.every((quest) => quest.progress === 0 && !quest.completed)).toBe(true)
  })
})

describe('Quêtes - règle 5 : progression plafonnée', () => {
  it("plafonne la progression à l'objectif", () => {
    const board = questBoard(PLAYER, DAY, ALL_DONE, [])
    for (const quest of board) {
      expect(quest.progress).toBe(quest.goal)
      expect(quest.completed).toBe(true)
    }
  })

  it("présente une progression partielle tant que l'objectif n'est pas atteint", () => {
    const player = playerWith('veteran')
    const veteran = questBoard(player, DAY, { gamesPlayed: 1 }, []).find(
      (quest) => quest.kind === 'veteran',
    )
    expect(veteran).toMatchObject({ progress: 1, goal: 3, completed: false })
  })
})

/** Tableau du jour dont la première quête est terminée, et les autres non. */
function boardWithFirstCompleted(claimed: QuestKind[] = []) {
  const first = QUESTS[dailyQuests(PLAYER, DAY)[0]]
  const board = questBoard(PLAYER, DAY, { [first.metric]: first.goal }, claimed)
  return { board, first: board[0] }
}

describe('Quêtes - règles 6 à 8 : réclamation de la récompense', () => {
  it('accepte la réclamation d’une quête terminée, non réclamée, avec un village', () => {
    const { board, first } = boardWithFirstCompleted()
    expect(checkClaim(board, 0, true)).toEqual({ ok: true, quest: first })
  })

  it('règle 6 : refuse la réclamation d’une quête non terminée', () => {
    const board = questBoard(PLAYER, DAY, {}, [])
    expect(checkClaim(board, 0, true)).toEqual({
      ok: false,
      error: { code: 'QUEST_NOT_COMPLETED' },
    })
  })

  it('règle 7 : refuse une seconde réclamation de la même quête', () => {
    const { first } = boardWithFirstCompleted()
    const { board } = boardWithFirstCompleted([first.kind])
    expect(board[0].claimed).toBe(true)
    expect(checkClaim(board, 0, true)).toEqual({ ok: false, error: { code: 'ALREADY_CLAIMED' } })
  })

  it('règle 8 : refuse la réclamation à un joueur sans village', () => {
    const { board } = boardWithFirstCompleted()
    expect(checkClaim(board, 0, false)).toEqual({ ok: false, error: { code: 'VILLAGE_REQUIRED' } })
  })

  it('refuse une quête absente du tableau du jour', () => {
    const { board } = boardWithFirstCompleted()
    expect(checkClaim(board, QUESTS_PER_DAY, true)).toEqual({
      ok: false,
      error: { code: 'QUEST_NOT_FOUND' },
    })
  })

  it("identifie le versement par le joueur, le jour et la quête, pour qu'un doublon soit ignoré", () => {
    expect(rewardTransferId(PLAYER, DAY, 'builder')).toBe(rewardTransferId(PLAYER, DAY, 'builder'))
    expect(rewardTransferId(PLAYER, DAY, 'builder')).not.toBe(
      rewardTransferId(PLAYER, '2026-10-24', 'builder'),
    )
  })
})

describe('Quêtes - règle 9 : badge du jour', () => {
  it('accorde le badge lorsque les quatre quêtes du jour sont terminées', () => {
    expect(hasBadge(questBoard(PLAYER, DAY, ALL_DONE, []))).toBe(true)
  })

  it("refuse le badge tant qu'une quête du jour n'est pas terminée", () => {
    const { board } = boardWithFirstCompleted()
    expect(hasBadge(board)).toBe(false)
  })
})
