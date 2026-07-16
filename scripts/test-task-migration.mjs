import assert from 'node:assert/strict'
import { createServer } from 'vite'

const LEGACY_KEY = 'voice-calendar:tasks'
const MARKER_KEY = 'voice-calendar:task-migration:v1'

class MemoryStorage {
  values = new Map()
  legacyWrites = 0

  getItem(key) {
    return this.values.get(key) ?? null
  }

  setItem(key, value) {
    if (key === LEGACY_KEY && this.values.has(key)) {
      this.legacyWrites += 1
    }
    this.values.set(key, String(value))
  }
}

function legacyTask(name, overrides = {}) {
  return {
    id: `legacy-${name}`,
    title: name,
    status: 'pending',
    priority: 'medium',
    estimatedDurationMinutes: 60,
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

function createBackend(initialTasks = [], failedPostAttempts = [], failGet = false) {
  const tasks = initialTasks.map((task) => ({
    ...task,
    schedulingStatus: 'unscheduled',
    scheduledEventId: null,
    scheduledAt: null,
  }))
  const failures = new Set(failedPostAttempts)
  let posts = 0

  return {
    tasks,
    get posts() {
      return posts
    },
    clearFailures() {
      failures.clear()
    },
    async fetch(input, init = {}) {
      const url = String(input)
      const method = init.method ?? 'GET'
      if (url === '/api/tasks' && method === 'GET') {
        if (failGet) {
          return jsonResponse({ error: 'unavailable', message: 'Unavailable' }, 503)
        }
        return jsonResponse(tasks)
      }
      if (url === '/api/tasks' && method === 'POST') {
        posts += 1
        if (failures.has(posts)) {
          return jsonResponse({ error: 'simulated', message: 'Simulated failure' }, 503)
        }
        const request = JSON.parse(String(init.body))
        const timestamp = `2026-07-17T00:00:0${tasks.length}.000Z`
        const task = {
          ...request,
          id: request.id ?? `backend-${tasks.length + 1}`,
          schedulingStatus: 'unscheduled',
          scheduledEventId: null,
          scheduledAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        tasks.push(task)
        return jsonResponse(task, 201)
      }
      return jsonResponse({ error: 'not_found', message: 'Not found' }, 404)
    },
  }
}

async function withEnvironment(options, run) {
  const storage = new MemoryStorage()
  const legacyRaw = JSON.stringify(options.legacy ?? [])
  storage.setItem(LEGACY_KEY, legacyRaw)
  storage.legacyWrites = 0
  const backend = createBackend(options.backend, options.failedPosts, options.failGet)
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  globalThis.fetch = backend.fetch.bind(backend)
  globalThis.localStorage = storage

  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })

  try {
    const migration = await server.ssrLoadModule('/src/migrations/taskMigration.ts')
    if (options.completedMarker) {
      storage.setItem(MARKER_KEY, JSON.stringify({
        version: 1,
        completed: true,
        completedAt: '2026-07-17T00:00:00.000Z',
      }))
    }
    await run({ backend, legacyRaw, migration, storage })
  } finally {
    await server.close()
    globalThis.fetch = originalFetch
    if (originalStorage === undefined) {
      delete globalThis.localStorage
    } else {
      globalThis.localStorage = originalStorage
    }
  }
}

async function initialMigration() {
  const legacy = [legacyTask('A'), legacyTask('B')]
  await withEnvironment({ legacy }, async ({ backend, legacyRaw, migration, storage }) => {
    const [first, concurrent] = await Promise.all([
      migration.migrateLegacyTasks(),
      migration.migrateLegacyTasks(),
    ])
    assert.equal(first.completed, true)
    assert.equal(concurrent.completed, true)
    assert.equal(first.migrated, 2)
    assert.equal(backend.tasks.length, 2)
    assert.equal(storage.getItem(LEGACY_KEY), legacyRaw)
    assert.equal(storage.legacyWrites, 0)
    assert.ok(storage.getItem(MARKER_KEY))
  })
}

async function existingPartialData() {
  const taskA = legacyTask('A')
  const taskB = legacyTask('B')
  await withEnvironment({ legacy: [taskA, taskB], backend: [taskA] }, async ({ backend, migration }) => {
    const result = await migration.migrateLegacyTasks()
    assert.equal(result.skipped, 1)
    assert.equal(result.migrated, 1)
    assert.equal(backend.tasks.length, 2)
  })
}

async function partialFailureRecovery() {
  const legacy = [legacyTask('A'), legacyTask('B'), legacyTask('C')]
  await withEnvironment({ legacy, failedPosts: [2] }, async ({ backend, migration, storage }) => {
    await assert.rejects(migration.migrateLegacyTasks(), migration.TaskMigrationError)
    assert.equal(storage.getItem(MARKER_KEY), null)
    assert.equal(backend.tasks.length, 2)
    backend.clearFailures()
    const recovered = await migration.migrateLegacyTasks()
    assert.equal(recovered.completed, true)
    assert.equal(backend.tasks.length, 3)
  })
}

async function completedMarker() {
  await withEnvironment({ legacy: [legacyTask('A')], completedMarker: true }, async ({ backend, migration }) => {
    const result = await migration.migrateLegacyTasks()
    assert.equal(result.alreadyCompleted, true)
    assert.equal(backend.posts, 0)
  })
}

async function backendUnavailable() {
  await withEnvironment({ legacy: [legacyTask('A')], failGet: true }, async ({ legacyRaw, migration, storage }) => {
    await assert.rejects(migration.migrateLegacyTasks(), migration.TaskMigrationError)
    assert.equal(storage.getItem(MARKER_KEY), null)
    assert.equal(storage.getItem(LEGACY_KEY), legacyRaw)
    assert.equal(storage.legacyWrites, 0)
  })
}

const tests = [
  ['empty backend migrates legacy tasks once', initialMigration],
  ['partial backend data is deduplicated by stable id', existingPartialData],
  ['partial failure leaves marker incomplete and recovers', partialFailureRecovery],
  ['completed marker skips migration writes', completedMarker],
  ['backend unavailable preserves legacy data', backendUnavailable],
]

for (const [name, test] of tests) {
  await test()
  console.log(`PASS ${name}`)
}
