import assert from 'node:assert/strict'
import { createServer } from 'vite'

const backendUrl = process.env.PR39_BACKEND_URL ?? 'http://127.0.0.1:8080'

function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatLocalTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

async function readReminderEvent(reader, eventId) {
  const decoder = new TextDecoder()
  let content = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      throw new Error('Reminder SSE stream closed before delivery')
    }
    content += decoder.decode(value, { stream: true })
    if (content.includes(`"eventId":"${eventId}"`)) {
      return content
    }
  }
}

function timeoutAfter(milliseconds) {
  return new Promise((_, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timed out waiting for reminder delivery')),
      milliseconds,
    )
    timer.unref()
  })
}

const originalFetch = globalThis.fetch
globalThis.fetch = (input, init) => originalFetch(new URL(String(input), backendUrl), init)

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const createdIds = []
const streamAbort = new AbortController()

try {
  const eventApi = await server.ssrLoadModule('/src/api/eventApi.ts')
  assert.equal((await eventApi.getEvents()).length, 0, 'Integration database must start empty')

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const baseEvent = {
    title: 'PR39 SQLite reminder mapping',
    description: 'Real backend persistence regression',
    date: formatLocalDate(tomorrow),
    startTime: '10:00',
    type: 'schedule',
  }

  const created = await eventApi.createEvent({
    ...baseEvent,
    reminderMinutesBefore: 10,
  })
  createdIds.push(created.id)
  assert.equal(created.reminderMinutesBefore, 10)
  assert.equal((await eventApi.getEventById(created.id)).reminderMinutesBefore, 10)

  await eventApi.updateEvent(created.id, {
    ...baseEvent,
    reminderMinutesBefore: 30,
  })
  assert.equal((await eventApi.getEventById(created.id)).reminderMinutesBefore, 30)

  await eventApi.updateEvent(created.id, {
    ...baseEvent,
    reminderMinutesBefore: null,
  })
  const disabled = await eventApi.getEventById(created.id)
  assert.equal(disabled.reminderEnabled, false)
  assert.equal(disabled.reminderMinutesBefore, null)

  const now = new Date()
  const noReminder = await eventApi.createEvent({
    ...baseEvent,
    title: 'PR39 no reminder delivery',
    date: formatLocalDate(now),
    startTime: formatLocalTime(now),
    reminderMinutesBefore: null,
  })
  createdIds.push(noReminder.id)

  const streamResponse = await originalFetch(`${backendUrl}/api/reminders/stream`, {
    signal: streamAbort.signal,
  })
  assert.equal(streamResponse.status, 200)
  assert.ok(streamResponse.body)
  const reader = streamResponse.body.getReader()

  const startReminder = await eventApi.createEvent({
    ...baseEvent,
    title: 'PR39 start-time reminder delivery',
    date: formatLocalDate(now),
    startTime: formatLocalTime(now),
    reminderMinutesBefore: 0,
  })
  createdIds.push(startReminder.id)

  const streamContent = await Promise.race([
    readReminderEvent(reader, startReminder.id),
    timeoutAfter(40000),
  ])
  assert.match(streamContent, /event: reminder/)

  const pendingResponse = await originalFetch(`${backendUrl}/api/reminders/pending`)
  assert.equal(pendingResponse.status, 200)
  const pending = await pendingResponse.json()
  const delivery = pending.find((item) => item.eventId === startReminder.id)
  assert.ok(delivery)
  assert.equal(pending.some((item) => item.eventId === noReminder.id), false)

  const ackResponse = await originalFetch(
    `${backendUrl}/api/reminders/${encodeURIComponent(delivery.id)}/ack`,
    { method: 'POST' },
  )
  assert.equal(ackResponse.status, 200)
  assert.equal((await ackResponse.json()).status, 'acknowledged')

  const afterAck = await (
    await originalFetch(`${backendUrl}/api/reminders/pending`)
  ).json()
  assert.equal(afterAck.some((item) => item.eventId === startReminder.id), false)

  console.log('PASS real SQLite create/reload/update/disable plus ReminderService/SSE/ACK delivery chain')
} finally {
  streamAbort.abort()
  try {
    const eventApi = await server.ssrLoadModule('/src/api/eventApi.ts')
    for (const id of createdIds) {
      await eventApi.deleteEvent(id)
    }
  } catch {
    // The test database is disposable; cleanup failure must not mask the primary result.
  }
  await server.close()
  globalThis.fetch = originalFetch
}
