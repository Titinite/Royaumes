import { describe, expect, it } from 'vitest'
import {
  decide,
  initialState,
  replay,
  stockAt,
  toView,
  upgradeCost,
  type VillageEvent,
} from './village'

// Instant de référence et conversion des minutes en millisecondes.
const T0 = Date.UTC(2026, 0, 1)
const minutes = (n: number) => n * 60_000

// Un village fondé à T0, point de départ de la plupart des tests.
const founded: VillageEvent = { type: 'VillageFounded', data: { name: 'Valombre', at: T0 } }

/** Applique une décision supposée acceptée et renvoie ses événements. */
function eventsOf(decision: ReturnType<typeof decide>): VillageEvent[] {
  if (!decision.ok) throw new Error(`Décision refusée : ${decision.error.code}`)
  return decision.events
}

describe('Village - fondation', () => {
  it('fonde un village avec le stock et les niveaux de départ', () => {
    const events = eventsOf(decide(initialState, { type: 'FoundVillage', name: 'Valombre' }, T0))
    const state = replay(events)

    expect(state.name).toBe('Valombre')
    expect(state.stock).toEqual({ wood: 100, stone: 50, gold: 0, wheat: 0 })
    expect(state.levels).toEqual({ sawmill: 1, quarry: 1, mine: 0, mill: 0 })
  })

  it('refuse de fonder un second village', () => {
    const decision = decide(replay([founded]), { type: 'FoundVillage', name: 'Autre' }, T0)
    expect(decision).toEqual({ ok: false, error: { code: 'ALREADY_FOUNDED' } })
  })
})

describe('Village - production paresseuse', () => {
  it('accumule la production en fonction du temps écoulé', () => {
    // Scierie 1 et carrière 1 : 10 bois et 6 pierres par minute.
    const view = toView(replay([founded]), T0 + minutes(5))
    expect(view.stock).toEqual({ wood: 150, stone: 80, gold: 0, wheat: 0 })
  })

  it("reproduit l'exemple du support : amélioration de la mine à 5 minutes", () => {
    const state = replay([founded])
    const events = eventsOf(
      decide(state, { type: 'UpgradeBuilding', building: 'mine' }, T0 + minutes(5)),
    )
    const after = replay([founded, ...events])

    // Juste après l'amélioration : 150 - 80 bois, 80 - 60 pierres.
    expect(after.stock).toEqual({ wood: 70, stone: 20, gold: 0, wheat: 0 })
    // Dix minutes plus tard, la mine produit 2 unités d'or par minute.
    expect(toView(after, T0 + minutes(15)).stock).toEqual({
      wood: 170,
      stone: 80,
      gold: 20,
      wheat: 0,
    })
  })

  it("extrapole le stock côté interface à partir d'une vue", () => {
    const view = toView(replay([founded]), T0)
    expect(stockAt(view, T0 + minutes(1))).toEqual({ wood: 110, stone: 56, gold: 0, wheat: 0 })
  })
})

describe('Village - amélioration', () => {
  it('applique la règle de coût', () => {
    expect(upgradeCost('sawmill', 1)).toEqual({ wood: 98, stone: 49 })
    expect(upgradeCost('sawmill', 2)).toEqual({ wood: 167, stone: 83 })
  })

  it('améliore un bâtiment et déduit son coût', () => {
    const events = eventsOf(
      decide(replay([founded]), { type: 'UpgradeBuilding', building: 'quarry' }, T0 + minutes(10)),
    )
    const state = replay([founded, ...events])

    expect(state.levels.quarry).toBe(2)
    // 100 + 10 minutes x 10 = 200 bois, moins 148 pour la carrière.
    expect(state.stock.wood).toBe(52)
  })

  it('indique les ressources manquantes', () => {
    // À T0, la mine coûte 60 pierres et le village n'en possède que 50.
    const decision = decide(replay([founded]), { type: 'UpgradeBuilding', building: 'mine' }, T0)
    expect(decision).toEqual({
      ok: false,
      error: { code: 'INSUFFICIENT_RESOURCES', missing: { stone: 10 } },
    })
  })

  it('refuse une amélioration avant la fondation', () => {
    const decision = decide(initialState, { type: 'UpgradeBuilding', building: 'sawmill' }, T0)
    expect(decision).toEqual({ ok: false, error: { code: 'NOT_FOUNDED' } })
  })

  it('refuse une amélioration au-delà du niveau maximal', () => {
    const atMax: VillageEvent = {
      type: 'BuildingUpgraded',
      data: { building: 'sawmill', toLevel: 10, cost: {}, at: T0 },
    }
    const decision = decide(
      replay([founded, atMax]),
      { type: 'UpgradeBuilding', building: 'sawmill' },
      T0,
    )
    expect(decision).toEqual({
      ok: false,
      error: { code: 'MAX_LEVEL_REACHED', building: 'sawmill' },
    })
  })

  it("ne modifie jamais l'état reçu", () => {
    const state = replay([founded])
    const copy = structuredClone(state)
    decide(state, { type: 'UpgradeBuilding', building: 'sawmill' }, T0 + minutes(60))
    toView(state, T0 + minutes(60))
    expect(state).toEqual(copy)
  })
})

describe('Village - festin', () => {
  // 300 unités de blé versées à la fondation : de quoi payer un festin.
  const wheat: VillageEvent = {
    type: 'ResourcesDeposited',
    data: { transferId: 'blé', resources: { wheat: 300 }, at: T0 },
  }
  // 300 blés de plus, pour un second festin.
  const moreWheat: VillageEvent = { ...wheat, data: { ...wheat.data, transferId: 'blé-2' } }
  const hold = (events: VillageEvent[], at: number) =>
    decide(replay(events), { type: 'HoldFeast' }, at)

  it("paie le festin en blé, et enregistre son augmentation et sa fin dans l'événement", () => {
    const events = eventsOf(hold([founded, wheat], T0))
    expect(events).toEqual([
      {
        type: 'FeastHeld',
        data: { cost: { wheat: 300 }, bonus: 0.25, until: T0 + minutes(5), at: T0 },
      },
    ])
    const view = toView(replay([founded, wheat, ...events]), T0)
    expect(view.stock.wheat).toBe(0)
    expect(view.feast).toEqual({ bonus: 0.25, until: T0 + minutes(5) })
  })

  it('augmente toute la production de 25 % pendant le festin', () => {
    const state = replay([founded, wheat, ...eventsOf(hold([founded, wheat], T0))])
    // Scierie 1 et carrière 1 : 12,5 bois et 7,5 pierres par minute pendant le festin.
    expect(toView(state, T0 + minutes(4)).stock).toEqual({
      wood: 150,
      stone: 80,
      gold: 0,
      wheat: 0,
    })
  })

  it("arrête l'augmentation à la fin du festin, même au milieu d'un intervalle", () => {
    const state = replay([founded, wheat, ...eventsOf(hold([founded, wheat], T0))])
    // 10 minutes de production, dont 5 augmentées : 100 + 12,5 bois, 60 + 7,5 pierres.
    const view = toView(state, T0 + minutes(10))
    expect(view.stock).toEqual({ wood: 212.5, stone: 117.5, gold: 0, wheat: 0 })
    expect(view.feast).toBeNull()
  })

  it("applique l'augmentation aux niveaux améliorés pendant le festin", () => {
    const feast = eventsOf(hold([founded, wheat], T0))
    const upgrade = eventsOf(
      decide(
        replay([founded, wheat, ...feast]),
        { type: 'UpgradeBuilding', building: 'sawmill' },
        T0,
      ),
    )
    const state = replay([founded, wheat, ...feast, ...upgrade])
    // Scierie 2 : 20 bois par minute, 25 pendant le festin.
    expect(toView(state, T0 + minutes(4)).stock.wood).toBe(state.stock.wood + 100)
  })

  it("refuse un second festin tant que le premier n'est pas terminé", () => {
    const events = [founded, wheat, ...eventsOf(hold([founded, wheat], T0)), moreWheat]
    expect(hold(events, T0 + minutes(4))).toEqual({
      ok: false,
      error: { code: 'FEAST_IN_PROGRESS', until: T0 + minutes(5) },
    })
  })

  it('accepte un nouveau festin dès la fin du précédent', () => {
    const events = [founded, wheat, ...eventsOf(hold([founded, wheat], T0)), moreWheat]
    expect(hold(events, T0 + minutes(5)).ok).toBe(true)
  })

  it('refuse un festin sans assez de blé, en indiquant la quantité manquante', () => {
    expect(hold([founded], T0)).toEqual({
      ok: false,
      error: { code: 'INSUFFICIENT_RESOURCES', missing: { wheat: 300 } },
    })
  })

  it("refuse un festin tant qu'aucun village n'est fondé", () => {
    expect(hold([], T0)).toEqual({ ok: false, error: { code: 'NOT_FOUNDED' } })
  })

  it("extrapole dans l'interface le même stock que le serveur, fin du festin comprise", () => {
    const state = replay([founded, wheat, ...eventsOf(hold([founded, wheat], T0))])
    const later = T0 + minutes(10)
    expect(stockAt(toView(state, T0 + minutes(2)), later)).toEqual(toView(state, later).stock)
  })
})
