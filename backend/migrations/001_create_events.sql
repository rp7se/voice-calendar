CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    type TEXT NOT NULL CHECK (type IN ('schedule', 'course', 'work', 'reminder')),
    category_id TEXT,
    reminder_enabled INTEGER NOT NULL DEFAULT 0 CHECK (reminder_enabled IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_category_id ON events(category_id);
