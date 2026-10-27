import { describe, expect, it } from 'vitest'
import { createTestApi } from './testing'

describe('API du module Village', () => {
  it("renvoie une vue nulle tant qu'aucun village n'est fondé", async () => {
    const { get } = await createTestApi()
    const res = await get('/api/realm/village')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ view: null })
  }, 15000)

  it('fonde un village (201) puis refuse une seconde fondation (409)', async () => {
    const { post } = await createTestApi()

    const first = await post('/api/realm/village', { name: 'Valombre' })
    expect(first.status).toBe(201)
    expect((await first.json()).view.name).toBe('Valombre')

    const second = await post('/api/realm/village', { name: 'Autre' })
    expect(second.status).toBe(409)
    expect(await second.json()).toEqual({ error: { code: 'ALREADY_FOUNDED' } })
  })

  it('rejette une entrée invalide avant tout appel au service (400)', async () => {
    const { post } = await createTestApi()
    const res = await post('/api/realm/village', { name: 'V' })

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_INPUT')
  })

  it('rejette un bâtiment inconnu (400)', async () => {
    const { post } = await createTestApi()
    await post('/api/realm/village', { name: 'Valombre' })
    const res = await post('/api/realm/village/upgrade', { building: 'castle' })

    expect(res.status).toBe(400)
  })

  it('traduit un stock insuffisant en erreur 422, puis accepte avec le temps', async () => {
    const { post, advance } = await createTestApi()
    await post('/api/realm/village', { name: 'Valombre' })

    const tooEarly = await post('/api/realm/village/upgrade', { building: 'mine' })
    expect(tooEarly.status).toBe(422)
    expect((await tooEarly.json()).error.missing).toEqual({ stone: 10 })

    advance(2)
    const later = await post('/api/realm/village/upgrade', { building: 'mine' })
    expect(later.status).toBe(200)
    expect((await later.json()).view.levels.mine).toBe(1)
  })
})

describe("Contrôle d'accès à l'API du Village", () => {
  it('refuse une lecture anonyme (401)', async () => {
    const { get } = await createTestApi()
    const res = await get('/api/realm/village', null)

    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('refuse une commande anonyme, sans rien enregistrer', async () => {
    const { get, post } = await createTestApi()
    const res = await post('/api/realm/village', { name: 'Valombre' }, null)

    expect(res.status).toBe(401)
    // Aucun village n'a été fondé, pour aucun joueur.
    expect(await (await get('/api/realm/village')).json()).toEqual({ view: null })
  })

  it('isole les villages des joueurs', async () => {
    const { get, post } = await createTestApi()
    await post('/api/realm/village', { name: 'Valombre' }, 'alice')
    await post('/api/realm/village', { name: 'Clairval' }, 'bob')

    expect((await (await get('/api/realm/village', 'alice')).json()).view.name).toBe('Valombre')
    expect((await (await get('/api/realm/village', 'bob')).json()).view.name).toBe('Clairval')
  })

  it('laisse la route de santé accessible sans connexion', async () => {
    const { get } = await createTestApi()
    expect((await get('/api/system/health', null)).status).toBe(200)
  })

  it('autorise un joueur à écouter le canal de son village', async () => {
    const { get, post } = await createTestApi()
    await post('/api/realm/village', { name: 'Valombre' })
    const res = await get('/api/stream/village-alice')

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('"type":"VillageFounded"')
  })

  it("refuse l'écoute du village d'un autre joueur (403)", async () => {
    const { get } = await createTestApi()
    expect((await get('/api/stream/village-bob', 'alice')).status).toBe(403)
  })
})

// Le festin est vérifié avec le Village exécuté dans l'application, puis extrait dans son
// service (TD11) : la nouvelle route doit franchir la passerelle sans aucune modification.
describe.each([
  { mode: "dans l'application", villageService: false },
  { mode: 'dans le service extrait', villageService: true },
])('Festin du Village, $mode', ({ villageService }) => {
  it('organise un festin payé en blé, puis refuse un second festin en cours (409)', async () => {
    const { post, advance } = await createTestApi({ villageService })
    await post('/api/realm/village', { name: 'Valombre' })
    // Le moulin coûte 150 bois et 100 pierres : il est construit au bout de 9 minutes,
    // puis produit 4 blés par minute, soit les 300 blés du festin en 75 minutes.
    advance(9)
    expect((await post('/api/realm/village/upgrade', { building: 'mill' })).status).toBe(200)

    const tooEarly = await post('/api/realm/village/feast', undefined)
    expect(tooEarly.status).toBe(422)
    expect((await tooEarly.json()).error.missing).toEqual({ wheat: 300 })

    advance(75)
    const feast = await post('/api/realm/village/feast', undefined)
    expect(feast.status).toBe(200)
    const { view } = await feast.json()
    expect(view.stock.wheat).toBe(0)
    expect(view.feast).toEqual({ bonus: 0.25, until: Date.UTC(2026, 0, 1) + 89 * 60_000 })

    const again = await post('/api/realm/village/feast', undefined)
    expect(again.status).toBe(409)
    expect((await again.json()).error.code).toBe('FEAST_IN_PROGRESS')
  }, 15000)

  it('refuse un festin anonyme (401)', async () => {
    const { post } = await createTestApi({ villageService })
    expect((await post('/api/realm/village/feast', undefined, null)).status).toBe(401)
  })
})
