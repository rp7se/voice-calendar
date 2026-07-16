CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
    priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
    deadline_date TEXT,
    deadline_time TEXT,
    estimated_duration_minutes INTEGER CHECK (
        estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0
    ),
    category_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (deadline_time IS NULL OR deadline_date IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline_date ON tasks(deadline_date);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
