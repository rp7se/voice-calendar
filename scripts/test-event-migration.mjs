import assert from 'node:assert/strict'
import { createServer } from 'vite'

const LEGACY_KEY = 'voice-calendar:events'
const MARKER_KEY = 'voice-calendar:event-migration:v1'

class MemoryStorage {
  values = new Map()
  legacyReads = 0

  getItem(key) {
    if (key === LEGACY_KEY) {
      this.legacyReads += 1
    }
    return this.values.get(key) ?? null
  }

  setItem(key, value) {
    this.values.set(key, String(value))
  }

  removeItem(key) {
    this.values.delete(key)
  }
}

function legacyEvent(name, startTime, overrides = {}) {
  return {
    id: `legacy-${name}`,
    title: name,
    description: `Legacy ${name}`,
    date: '2026-07-16',
    startTime,
    type: 'schedule',
    reminderEnabled: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function jsonResponse(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: body === null ? undefined : { 'Content-Type': 'application/json' },
  })
}

function createBackend(initialEvents = [], failedPostAttempts = [], failedGetAttempts = []) {
  const events = initialEvents.map((event) => ({ ...event }))
  const failures = new Set(failedPostAttempts)
  const getFailures = new Set(failedGetAttempts)
  let getAttempts = 0
  let postAttempts = 0
  let successfulPosts = 0

  return {
    events,
    get postAttempts() {
      return postAttempts
    },
    get successfulPosts() {
      return successfulPosts
    },
    async fetch(input, init = {}) {
      const url = String(input)
      const method = init.method ?? 'GET'
      if (url === '/api/events' && method === 'GET') {
        getAttempts += 1
        if (getFailures.has(getAttempts)) {
          return jsonResponse(
            { error: 'simulated_unavailable', message: 'Backend unavailable' },
            503,
          )
        }
        return jsonResponse(events)
      }
      if (url === '/api/events' && method === 'POST') {
        postAttempts += 1
        if (failures.has(postAttempts)) {
          return jsonResponse(
            { error: 'simulated_failure', message: 'Simulated migration failure' },
            503,
          )
        }

        const request = JSON.parse(String(init.body))
        const timestamp = `2026-07-16T00:00:0${successfulPosts}.000Z`
        const event = {
          ...request,
          id: `backend-${events.length + 1}`,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        events.push(event)
        successfulPosts += 1
        return jsonResponse(event, 201)
      }
      return jsonResponse({ error: 'not_found', message: 'Not found' }, 404)
    },
    clearFailures() {
      failures.clear()
    },
  }
}

async function withMigrationEnvironment(options, run) {
  const storage = new MemoryStorage()
  const legacyRaw = options.legacy === undefined ? null : JSON.stringify(options.legacy)
  if (legacyRaw !== null) {
    storage.setItem(LEGACY_KEY, legacyRaw)
  }

  const backend = createBackend(
    options.backend,
    options.failedPostAttempts,
    options.failedGetAttempts,
  )
  const originalFetch = globalThis.fetch
  const originalLocalStorage = globalThis.localStorage
  globalThis.fetch = backend.fetch.bind(backend)
  globalThis.localStorage = storage

  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })

  try {
    const migration = await server.ssrLoadModule('/src/migrations/eventMigration.ts')
    if (options.completedMarker) {
      storage.setItem(
        migration.EVENT_MIGRATION_MARKER_KEY,
        JSON.stringify({
          version: 1,
          completed: true,
          completedAt: '2026-07-16T00:00:00.000Z',
        }),
      )
    }
    await run({ backend, legacyRaw, migration, storage })
  } finally {
    await server.close()
    globalThis.fetch = originalFetch
    if (originalLocalStorage === undefined) {
      delete globalThis.localStorage
    } else {
      globalThis.localStorage = originalLocalStorage
    }
  }
}

async function testInitialMigrationAndConcurrency() {
  const legacy = [
    legacyEvent('A', '08:00'),
    legacyEvent('B', '09:00'),
    legacyEvent('C', '10:00'),
  ]
  await withMigrationEnvironment({ legacy, backend: [] }, async ({ backend, legacyRaw, migration, storage }) => {
    const [first, concurrent] = await Promise.all([
      migration.migrateLegacyEvents(),
      migration.migrateLegacyEvents(),
    ])
    assert.equal(first.completed, true)
    assert.equal(concurrent.completed, true)
    assert.equal(first.migrated, 3)
    assert.equal(backend.events.length, 3)
    assert.equal(backend.successfulPosts, 3)
    assert.equal(storage.getItem(LEGACY_KEY), legacyRaw)
    assert.ok(storage.getItem(MARKER_KEY))

    const refresh = await migration.migrateLegacyEvents()
    assert.equal(refresh.alreadyCompleted, true)
    assert.equal(backend.successfulPosts, 3)
  })
}

async function testExistingDuplicate() {
  const eventA = legacyEvent('A', '08:00')
  const backendA = {
    ...eventA,
    id: 'backend-a',
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
  }
  const eventB = legacyEvent('B', '09:00')

  await withMigrationEnvironment(
    { legacy: [eventA, eventB], backend: [backendA] },
    async ({ backend, migration }) => {
      const result = await migration.migrateLegacyEvents()
      assert.equal(result.completed, true)
      assert.equal(result.skipped, 1)
      assert.equal(result.migrated, 1)
      assert.equal(backend.events.length, 2)
      assert.equal(backend.events.filter((event) => event.title === 'A').length, 1)
    },
  )
}

async function testPartialFailureAndRecovery() {
  const legacy = [
    legacyEvent('A', '08:00'),
    legacyEvent('B', '09:00'),
    legacyEvent('C', '10:00'),
  ]
  await withMigrationEnvironment(
    { legacy, backend: [], failedPostAttempts: [2] },
    async ({ backend, legacyRaw, migration, storage }) => {
      await assert.rejects(
        migration.migrateLegacyEvents(),
        (error) => error instanceof migration.EventMigrationError,
      )
      assert.equal(storage.getItem(MARKER_KEY), null)
      assert.equal(storage.getItem(LEGACY_KEY), legacyRaw)
      assert.equal(backend.events.length, 2)

      backend.clearFailures()
      const recovered = await migration.migrateLegacyEvents()
      assert.equal(recovered.completed, true)
      assert.equal(recovered.skipped, 2)
      assert.equal(recovered.migrated, 1)
      assert.equal(backend.events.length, 3)
      assert.ok(storage.getItem(MARKER_KEY))
    },
  )
}

async function testCompletedMarkerSkipsLegacyScan() {
  await withMigrationEnvironment(
    {
      legacy: [legacyEvent('Legacy should not be scanned', '08:00')],
      backend: [],
      completedMarker: true,
    },
    async ({ backend, migration, storage }) => {
      storage.legacyReads = 0
      const result = await migration.migrateLegacyEvents()
      assert.equal(result.alreadyCompleted, true)
      assert.equal(storage.legacyReads, 0)
      assert.equal(backend.postAttempts, 0)
    },
  )
}

async function testBackendUnavailablePreservesLegacy() {
  const legacy = [legacyEvent('A', '08:00')]
  await withMigrationEnvironment(
    { legacy, backend: [], failedGetAttempts: [1] },
    async ({ legacyRaw, migration, storage }) => {
      await assert.rejects(
        migration.migrateLegacyEvents(),
        (error) =>
          error instanceof migration.EventMigrationError &&
          error.message === '无法连接日程服务，旧日程尚未迁移。',
      )
      assert.equal(storage.getItem(MARKER_KEY), null)
      assert.equal(storage.getItem(LEGACY_KEY), legacyRaw)
    },
  )
}

async function testNoLegacyEvents() {
  await withMigrationEnvironment({ backend: [] }, async ({ backend, migration, storage }) => {
    const result = await migration.migrateLegacyEvents()
    assert.equal(result.completed, true)
    assert.equal(result.legacyCount, 0)
    assert.equal(backend.postAttempts, 0)
    assert.ok(storage.getItem(MARKER_KEY))
  })
}

const tests = [
  ['initial migration and concurrent initialization', testInitialMigrationAndConcurrency],
  ['existing duplicate', testExistingDuplicate],
  ['partial failure and recovery', testPartialFailureAndRecovery],
  ['backend unavailable preserves legacy data', testBackendUnavailablePreservesLegacy],
  ['completed marker skips legacy scan', testCompletedMarkerSkipsLegacyScan],
  ['no legacy events', testNoLegacyEvents],
]

for (const [name, test] of tests) {
  await test()
  console.log(`PASS ${name}`)
}
