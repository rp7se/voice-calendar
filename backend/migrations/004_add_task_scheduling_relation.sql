ALTER TABLE tasks
ADD COLUMN scheduling_status TEXT NOT NULL DEFAULT 'unscheduled'
CHECK (scheduling_status IN ('unscheduled', 'scheduled'));

ALTER TABLE tasks
ADD COLUMN scheduled_event_id TEXT;

ALTER TABLE tasks
ADD COLUMN scheduled_at TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_scheduling_status
ON tasks(scheduling_status);

CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_event_id
ON tasks(scheduled_event_id);
