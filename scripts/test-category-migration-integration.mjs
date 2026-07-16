import assert from 'node:assert/strict'
import { createServer } from 'vite'

const backendUrl = process.env.PR35_BACKEND_URL ?? 'http://127.0.0.1:8080'
const LEGACY_KEY = 'voice-calendar:categories'
const MARKER_KEY = 'voice-calendar:category-migration:v1'

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
}

const legacy = [
  { id: 'pr35-legacy-study', name: 'PR35 学习', description: '学习分类', createdAt: '2026-07-01T00:00:00.000Z' },
  { id: 'pr35-legacy-work', name: 'PR35 工作', description: '工作分类', createdAt: '2026-07-01T00:00:00.000Z' },
]
const storage = new MemoryStorage()
const legacyRaw = JSON.stringify(legacy)
storage.setItem(LEGACY_KEY, legacyRaw)

const originalFetch = globalThis.fetch
const originalStorage = globalThis.localStorage
let postCount = 0
globalThis.localStorage = storage
globalThis.fetch = async (input, init = {}) => {
  if ((init.method ?? 'GET') === 'POST' && String(input) === '/api/categories') {
    postCount += 1
  }
  return originalFetch(new URL(String(input), backendUrl), init)
}

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })

try {
  const migration = await server.ssrLoadModule('/src/migrations/categoryMigration.ts')
  const api = await server.ssrLoadModule('/src/api/categoryApi.ts')
  assert.deepEqual(await api.getCategories(), [])

  const [first, concurrent] = await Promise.all([
    migration.migrateLegacyCategories(),
    migration.migrateLegacyCategories(),
  ])
  assert.equal(first.completed, true)
  assert.equal(concurrent.completed, true)
  assert.equal(postCount, 2)
  assert.deepEqual(first.categories.map((item) => item.id).sort(), legacy.map((item) => item.id).sort())
  assert.equal(storage.getItem(LEGACY_KEY), legacyRaw)
  assert.ok(storage.getItem(MARKER_KEY))

  const refresh = await migration.migrateLegacyCategories()
  assert.equal(refresh.alreadyCompleted, true)
  assert.equal(postCount, 2)

  for (const category of await api.getCategories()) {
    await api.deleteCategory(category.id)
  }
  assert.deepEqual(await api.getCategories(), [])
  console.log('PASS real SQLite Category migration, stable ids, and idempotent refresh')
} finally {
  await server.close()
  globalThis.fetch = originalFetch
  if (originalStorage === undefined) delete globalThis.localStorage
  else globalThis.localStorage = originalStorage
}
