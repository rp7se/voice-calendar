import assert from 'node:assert/strict'
import { createServer } from 'vite'

const backendUrl = process.env.PR29_BACKEND_URL ?? 'http://127.0.0.1:8080'
const LEGACY_KEY = 'voice-calendar:events'
const MARKER_KEY = 'voice-calendar:event-migration:v1'

class MemoryStorage {
  values = new Map()

  getItem(key) {
    return this.values.get(key) ?? null
  }

  setItem(key, value) {
    this.values.set(key, String(value))
  }
}

function legacyEvent(name, startTime) {
  return {
    id: `legacy-${name}`,
    title: name,
    description: `Legacy integration ${name}`,
    date: '2026-07-16',
    startTime,
    type: 'work',
    reminderEnabled: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  }
}

const storage = new MemoryStorage()
const legacy = [
  legacyEvent('PR29 integration A', '08:00'),
  legacyEvent('PR29 integration B', '09:00'),
  legacyEvent('PR29 integration C', '10:00'),
]
const legacyRaw = JSON.stringify(legacy)
storage.setItem(LEGACY_KEY, legacyRaw)

const originalFetch = globalThis.fetch
const originalLocalStorage = globalThis.localStorage
let postCount = 0
globalThis.localStorage = storage
globalThis.fetch = async (input, init = {}) => {
  if ((init.method ?? 'GET') === 'POST') {
    postCount += 1
  }
  return originalFetch(new URL(String(input), backendUrl), init)
}

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const migration = await server.ssrLoadModule('/src/migrations/eventMigration.ts')
  const eventApi = await server.ssrLoadModule('/src/api/eventApi.ts')
  const before = await eventApi.getEvents()
  assert.equal(before.length, 0, 'Integration database must start empty')

  const [first, concurrent] = await Promise.all([
    migration.migrateLegacyEvents(),
    migration.migrateLegacyEvents(),
  ])
  assert.equal(first.completed, true)
  assert.equal(concurrent.completed, true)
  assert.equal(postCount, 3)
  assert.equal((await eventApi.getEvents()).length, 3)
  assert.equal(storage.getItem(LEGACY_KEY), legacyRaw)
  assert.ok(storage.getItem(MARKER_KEY))

  const refresh = await migration.migrateLegacyEvents()
  assert.equal(refresh.alreadyCompleted, true)
  assert.equal(postCount, 3)

  const created = await eventApi.createEvent({
    title: 'PR29 CRUD regression',
    description: 'Created after migration',
    date: '2026-07-17',
    startTime: '11:00',
    type: 'schedule',
    reminderEnabled: false,
  })
  const updated = await eventApi.updateEvent(created.id, {
    title: 'PR29 CRUD regression updated',
    description: 'Updated after migration',
    date: '2026-07-17',
    startTime: '11:30',
    type: 'schedule',
    reminderEnabled: false,
  })
  assert.equal(updated.title, 'PR29 CRUD regression updated')
  await eventApi.deleteEvent(created.id)
  assert.equal((await eventApi.getEvents()).length, 3)

  console.log('PASS real SQLite migration, idempotent refresh, and CRUD regression')
} finally {
  await server.close()
  globalThis.fetch = originalFetch
  if (originalLocalStorage === undefined) {
    delete globalThis.localStorage
  } else {
    globalThis.localStorage = originalLocalStorage
  }
}
