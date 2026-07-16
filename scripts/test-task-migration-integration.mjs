import assert from 'node:assert/strict'
import { createServer } from 'vite'

const backendUrl = process.env.PR34_BACKEND_URL ?? 'http://127.0.0.1:8080'
const LEGACY_KEY = 'voice-calendar:tasks'
const MARKER_KEY = 'voice-calendar:task-migration:v1'

class MemoryStorage {
  values = new Map()

  getItem(key) {
    return this.values.get(key) ?? null
  }

  setItem(key, value) {
    this.values.set(key, String(value))
  }
}

function legacyTask(name, priority) {
  return {
    id: `pr34-integration-${name}`,
    title: `PR34 migration ${name}`,
    status: 'pending',
    priority,
    deadlineDate: '2026-07-24',
    estimatedDurationMinutes: 60,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  }
}

const storage = new MemoryStorage()
const legacy = [legacyTask('A', 'high'), legacyTask('B', 'medium')]
const legacyRaw = JSON.stringify(legacy)
storage.setItem(LEGACY_KEY, legacyRaw)

const originalFetch = globalThis.fetch
const originalStorage = globalThis.localStorage
let postCount = 0
globalThis.localStorage = storage
globalThis.fetch = async (input, init = {}) => {
  if ((init.method ?? 'GET') === 'POST' && String(input) === '/api/tasks') {
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
  const migration = await server.ssrLoadModule('/src/migrations/taskMigration.ts')
  const taskApi = await server.ssrLoadModule('/src/api/taskApi.ts')
  assert.deepEqual(await taskApi.getTasks(), [], 'Integration database must start empty')

  const [first, concurrent] = await Promise.all([
    migration.migrateLegacyTasks(),
    migration.migrateLegacyTasks(),
  ])
  assert.equal(first.completed, true)
  assert.equal(concurrent.completed, true)
  assert.equal(postCount, 2)
  assert.equal(first.tasks.length, 2)
  assert.deepEqual(first.tasks.map((task) => task.id).sort(), legacy.map((task) => task.id).sort())
  assert.equal(storage.getItem(LEGACY_KEY), legacyRaw)
  assert.ok(storage.getItem(MARKER_KEY))

  const refresh = await migration.migrateLegacyTasks()
  assert.equal(refresh.alreadyCompleted, true)
  assert.equal(postCount, 2)

  for (const task of await taskApi.getTasks()) {
    await taskApi.deleteTask(task.id)
  }
  assert.deepEqual(await taskApi.getTasks(), [])

  console.log('PASS real SQLite Task migration, stable-id deduplication, and idempotent refresh')
} finally {
  await server.close()
  globalThis.fetch = originalFetch
  if (originalStorage === undefined) {
    delete globalThis.localStorage
  } else {
    globalThis.localStorage = originalStorage
  }
}
