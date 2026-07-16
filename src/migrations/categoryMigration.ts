import { createCategory, getCategories } from '../api/categoryApi.ts'
import type { EventCategory, EventCategoryInput } from '../types/calendar.ts'
import { LEGACY_CATEGORY_STORAGE_KEY } from '../utils/storage.ts'

export const CATEGORY_MIGRATION_MARKER_KEY = 'voice-calendar:category-migration:v1'

type CategoryMigrationMarker = {
  version: 1
  completed: true
  completedAt: string
}

type LegacyCategory = {
  id?: string
  input: EventCategoryInput
}

type LegacyReadResult = {
  categories: LegacyCategory[]
  invalid: number
  readFailed: boolean
}

export type CategoryMigrationResult = {
  migrated: number
  skipped: number
  failed: number
  completed: boolean
  alreadyCompleted: boolean
  legacyCount: number
  backendCount: number
  categories: EventCategory[]
}

export class CategoryMigrationError extends Error {
  readonly result: CategoryMigrationResult

  constructor(message: string, result: CategoryMigrationResult) {
    super(message)
    this.name = 'CategoryMigrationError'
    this.result = result
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseLegacyCategory(value: unknown): LegacyCategory | null {
  if (!isRecord(value)) {
    return null
  }

  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const id = typeof value.id === 'string' && value.id.trim() ? value.id : undefined
  const description = value.description
  if (!name || (description !== undefined && typeof description !== 'string')) {
    return null
  }

  return {
    id,
    input: {
      name,
      description: typeof description === 'string' && description.trim()
        ? description
        : undefined,
    },
  }
}

function readLegacyCategories(): LegacyReadResult {
  let raw: string | null
  try {
    raw = localStorage.getItem(LEGACY_CATEGORY_STORAGE_KEY)
  } catch {
    return { categories: [], invalid: 0, readFailed: true }
  }

  if (raw === null || !raw.trim()) {
    return { categories: [], invalid: 0, readFailed: false }
  }

  let value: unknown
  try {
    value = JSON.parse(raw) as unknown
  } catch {
    return { categories: [], invalid: 1, readFailed: true }
  }
  if (!Array.isArray(value)) {
    return { categories: [], invalid: 1, readFailed: true }
  }

  const categories: LegacyCategory[] = []
  let invalid = 0
  for (const item of value) {
    const category = parseLegacyCategory(item)
    if (category) {
      categories.push(category)
    } else {
      invalid += 1
    }
  }
  return { categories, invalid, readFailed: false }
}

function isMigrationCompleted(): boolean {
  try {
    const raw = localStorage.getItem(CATEGORY_MIGRATION_MARKER_KEY)
    if (!raw) {
      return false
    }
    const value: unknown = JSON.parse(raw)
    return isRecord(value) && value.version === 1 && value.completed === true &&
      typeof value.completedAt === 'string'
  } catch {
    return false
  }
}

function writeMigrationMarker(): boolean {
  const marker: CategoryMigrationMarker = {
    version: 1,
    completed: true,
    completedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(CATEGORY_MIGRATION_MARKER_KEY, JSON.stringify(marker))
    return isMigrationCompleted()
  } catch {
    return false
  }
}

function normalizedName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

function matchesBackendCategory(
  legacy: LegacyCategory,
  backendCategories: readonly EventCategory[],
): boolean {
  if (legacy.id) {
    return backendCategories.some((category) => category.id === legacy.id)
  }
  const name = normalizedName(legacy.input.name)
  return backendCategories.some((category) => normalizedName(category.name) === name)
}

function incompleteResult(
  legacyCount: number,
  failed: number,
  categories: EventCategory[] = [],
): CategoryMigrationResult {
  return {
    migrated: 0,
    skipped: 0,
    failed,
    completed: false,
    alreadyCompleted: false,
    legacyCount,
    backendCount: categories.length,
    categories,
  }
}

async function runLegacyCategoryMigration(): Promise<CategoryMigrationResult> {
  if (isMigrationCompleted()) {
    const categories = await getCategories()
    return {
      migrated: 0,
      skipped: 0,
      failed: 0,
      completed: true,
      alreadyCompleted: true,
      legacyCount: 0,
      backendCount: categories.length,
      categories,
    }
  }

  const legacy = readLegacyCategories()
  const legacyCount = legacy.categories.length + legacy.invalid
  if (legacy.readFailed) {
    throw new CategoryMigrationError(
      '旧分类数据无法安全读取，迁移尚未完成。旧数据已保留。',
      incompleteResult(legacyCount, Math.max(legacy.invalid, 1)),
    )
  }

  let backendCategories: EventCategory[]
  try {
    backendCategories = await getCategories()
  } catch {
    throw new CategoryMigrationError(
      '暂时无法连接分类服务，旧分类尚未迁移。',
      incompleteResult(legacyCount, legacyCount),
    )
  }

  let migrated = 0
  let skipped = 0
  for (const category of legacy.categories) {
    if (matchesBackendCategory(category, backendCategories)) {
      skipped += 1
      continue
    }

    try {
      const created = await createCategory(category.input, category.id)
      backendCategories = [...backendCategories, created]
      migrated += 1
    } catch {
      // The final GET verifies whether a response was lost after a successful write.
    }
  }

  try {
    backendCategories = await getCategories()
  } catch {
    throw new CategoryMigrationError(
      '旧分类迁移后无法完成验证，迁移标记尚未写入。旧数据已保留。',
      {
        ...incompleteResult(legacyCount, legacyCount, backendCategories),
        migrated,
        skipped,
      },
    )
  }

  const missing = legacy.categories.filter(
    (category) => !matchesBackendCategory(category, backendCategories),
  ).length
  const failed = legacy.invalid + missing
  if (failed > 0) {
    throw new CategoryMigrationError(
      '旧分类迁移暂未完成，请确认分类服务正常运行。旧数据已保留。',
      {
        migrated,
        skipped,
        failed,
        completed: false,
        alreadyCompleted: false,
        legacyCount,
        backendCount: backendCategories.length,
        categories: backendCategories,
      },
    )
  }

  if (!writeMigrationMarker()) {
    throw new CategoryMigrationError(
      '旧分类已写入分类服务，但无法保存迁移完成标记。旧数据已保留。',
      {
        migrated,
        skipped,
        failed: 1,
        completed: false,
        alreadyCompleted: false,
        legacyCount,
        backendCount: backendCategories.length,
        categories: backendCategories,
      },
    )
  }

  return {
    migrated,
    skipped,
    failed: 0,
    completed: true,
    alreadyCompleted: false,
    legacyCount,
    backendCount: backendCategories.length,
    categories: backendCategories,
  }
}

let activeMigration: Promise<CategoryMigrationResult> | null = null

export function migrateLegacyCategories(): Promise<CategoryMigrationResult> {
  if (activeMigration) {
    return activeMigration
  }

  const migration = runLegacyCategoryMigration()
  const sharedMigration = migration.then(
    (result) => {
      if (activeMigration === sharedMigration) {
        activeMigration = null
      }
      return result
    },
    (error: unknown) => {
      if (activeMigration === sharedMigration) {
        activeMigration = null
      }
      throw error
    },
  )
  activeMigration = sharedMigration
  return sharedMigration
}
