ALTER TABLE events
ADD COLUMN reminder_minutes_before INTEGER
CHECK (
    reminder_minutes_before IS NULL OR
    reminder_minutes_before BETWEEN 0 AND 10080
);

UPDATE events
SET reminder_minutes_before = 0
WHERE reminder_enabled = 1;

CREATE TABLE reminder_deliveries (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    triggered_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'acknowledged')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE (event_id, scheduled_for)
);

CREATE INDEX idx_reminder_deliveries_status_triggered
ON reminder_deliveries(status, triggered_at);

CREATE INDEX idx_reminder_deliveries_event_id
ON reminder_deliveries(event_id);

CREATE INDEX idx_events_reminder_candidates
ON events(date, start_time)
WHERE reminder_minutes_before IS NOT NULL;
