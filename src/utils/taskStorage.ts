// PR34 keeps this key only as a read-only legacy backup for one-time migration.
// Runtime Task CRUD is handled exclusively by the C++ Backend API.
export const LEGACY_TASK_STORAGE_KEY = 'voice-calendar:tasks'
