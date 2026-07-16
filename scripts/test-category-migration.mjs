import assert from 'node:assert/strict'
import { createServer } from 'vite'

const LEGACY_KEY = 'voice-calendar:categories'
const MARKER_KEY = 'voice-calendar:category-migration:v1'

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

function legacyCategory(name, overrides = {}) {
  return {
    id: `legacy-${name}`,
    name,
    description: `${name} description`,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function jsonResponse(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: body === null ? undefined : { 'Content-Type': 'application/json' },
  })
}

function createBackend(initialCategories = [], failedPosts = [], failGet = false) {
  const categories = initialCategories.map((category) => ({ ...category }))
  const failures = new Set(failedPosts)
  let posts = 0

  return {
    categories,
    get posts() {
      return posts
    },
    clearFailures() {
      failures.clear()
    },
    async fetch(input, init = {}) {
      const url = String(input)
      const method = init.method ?? 'GET'
      if (url === '/api/categories' && method === 'GET') {
        if (failGet) {
          return jsonResponse({ error: 'unavailable', message: 'Unavailable' }, 503)
        }
        return jsonResponse(categories)
      }
      if (url === '/api/categories' && method === 'POST') {
        posts += 1
        if (failures.has(posts)) {
          return jsonResponse({ error: 'simulated', message: 'Simulated failure' }, 503)
        }
        const request = JSON.parse(String(init.body))
        const timestamp = `2026-07-17T00:00:0${categories.length}.000Z`
        const category = {
          ...request,
          id: request.id ?? `backend-${categories.length + 1}`,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        categories.push(category)
        return jsonResponse(category, 201)
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
    const migration = await server.ssrLoadModule('/src/migrations/categoryMigration.ts')
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
  const legacy = [legacyCategory('学习'), legacyCategory('工作')]
  await withEnvironment({ legacy }, async ({ backend, legacyRaw, migration, storage }) => {
    const [first, concurrent] = await Promise.all([
      migration.migrateLegacyCategories(),
      migration.migrateLegacyCategories(),
    ])
    assert.equal(first.completed, true)
    assert.equal(concurrent.completed, true)
    assert.equal(first.migrated, 2)
    assert.deepEqual(backend.categories.map((item) => item.id), legacy.map((item) => item.id))
    assert.equal(storage.getItem(LEGACY_KEY), legacyRaw)
    assert.equal(storage.legacyWrites, 0)
    assert.ok(storage.getItem(MARKER_KEY))
  })
}

async function partialBackend() {
  const categoryA = legacyCategory('学习')
  const categoryB = legacyCategory('工作')
  await withEnvironment(
    { legacy: [categoryA, categoryB], backend: [{ ...categoryA, updatedAt: categoryA.createdAt }] },
    async ({ backend, migration }) => {
      const result = await migration.migrateLegacyCategories()
      assert.equal(result.skipped, 1)
      assert.equal(result.migrated, 1)
      assert.equal(backend.categories.length, 2)
    },
  )
}

async function partialFailure() {
  const legacy = [legacyCategory('A'), legacyCategory('B'), legacyCategory('C')]
  await withEnvironment({ legacy, failedPosts: [2] }, async ({ backend, migration, storage }) => {
    await assert.rejects(migration.migrateLegacyCategories(), migration.CategoryMigrationError)
    assert.equal(storage.getItem(MARKER_KEY), null)
    backend.clearFailures()
    const recovered = await migration.migrateLegacyCategories()
    assert.equal(recovered.completed, true)
    assert.equal(backend.categories.length, 3)
  })
}

async function backendUnavailable() {
  await withEnvironment(
    { legacy: [legacyCategory('A')], failGet: true },
    async ({ legacyRaw, migration, storage }) => {
      await assert.rejects(migration.migrateLegacyCategories(), migration.CategoryMigrationError)
      assert.equal(storage.getItem(MARKER_KEY), null)
      assert.equal(storage.getItem(LEGACY_KEY), legacyRaw)
      assert.equal(storage.legacyWrites, 0)
    },
  )
}

async function completedMarker() {
  await withEnvironment(
    { legacy: [legacyCategory('A')], completedMarker: true },
    async ({ backend, migration }) => {
      const result = await migration.migrateLegacyCategories()
      assert.equal(result.alreadyCompleted, true)
      assert.equal(backend.posts, 0)
    },
  )
}

const tests = [
  ['empty backend migrates categories with stable ids', initialMigration],
  ['partial backend categories are not duplicated', partialBackend],
  ['partial failure leaves marker incomplete and recovers', partialFailure],
  ['backend unavailable preserves legacy categories', backendUnavailable],
  ['completed marker prevents repeated posts', completedMarker],
]

for (const [name, test] of tests) {
  await test()
  console.log(`PASS ${name}`)
}
