import assert from 'node:assert/strict'
import { createServer } from 'vite'

const events = []
const requests = []

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function toBackendEvent(request, id, createdAt = '2026-07-18T00:00:00.000Z') {
  return {
    ...request,
    id,
    createdAt,
    updatedAt: createdAt,
  }
}

async function fakeFetch(input, init = {}) {
  const url = String(input)
  const method = init.method ?? 'GET'

  if (url === '/api/events' && method === 'GET') {
    return jsonResponse(events)
  }

  if (url === '/api/events' && method === 'POST') {
    const request = JSON.parse(String(init.body))
    requests.push({ method, request })
    const event = toBackendEvent(request, `event-${events.length + 1}`)
    events.push(event)
    return jsonResponse(event, 201)
  }

  const match = /^\/api\/events\/([^/]+)$/.exec(url)
  if (match && method === 'PUT') {
    const request = JSON.parse(String(init.body))
    requests.push({ method, request })
    const index = events.findIndex((event) => event.id === match[1])
    const updated = {
      ...events[index],
      ...request,
      updatedAt: '2026-07-18T00:01:00.000Z',
    }
    events[index] = updated
    return jsonResponse(updated)
  }

  return jsonResponse({ error: 'not_found', message: 'Not found' }, 404)
}

const baseEvent = {
  title: 'PR39 reminder mapping',
  description: 'Frontend reminder configuration regression',
  date: '2026-07-19',
  startTime: '10:00',
  type: 'schedule',
}

const originalFetch = globalThis.fetch
globalThis.fetch = fakeFetch

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const eventApi = await server.ssrLoadModule('/src/api/eventApi.ts')
  const reminder = await server.ssrLoadModule('/src/utils/reminder.ts')

  const expectedReminderOptions = [
    [null, '不提醒'],
    [0, '开始时提醒'],
    [5, '提前 5 分钟'],
    [10, '提前 10 分钟'],
    [15, '提前 15 分钟'],
    [30, '提前 30 分钟'],
    [60, '提前 1 小时'],
    [1440, '提前 1 天'],
  ]
  assert.deepEqual(
    reminder.REMINDER_OPTIONS.map((option) => [option.value, option.label]),
    expectedReminderOptions,
  )
  for (const [value, label] of expectedReminderOptions) {
    assert.equal(reminder.formatReminderLabel(value), label)
    assert.equal(reminder.parseReminderSelectValue(value === null ? '' : String(value)), value)
  }
  assert.equal(reminder.parseReminderSelectValue('10'), 10)
  assert.equal(reminder.parseReminderSelectValue('-1'), null)
  assert.equal(reminder.parseReminderSelectValue('NaN'), null)
  assert.equal(reminder.parseReminderSelectValue('10081'), null)

  const created = await eventApi.createEvent({
    ...baseEvent,
    reminderMinutesBefore: 10,
  })
  assert.equal(requests.at(-1).request.reminderEnabled, true)
  assert.equal(requests.at(-1).request.reminderMinutesBefore, 10)
  assert.equal(created.reminderMinutesBefore, 10)
  assert.equal((await eventApi.getEvents())[0].reminderMinutesBefore, 10)

  const updated = await eventApi.updateEvent(created.id, {
    ...baseEvent,
    reminderMinutesBefore: 30,
  })
  assert.equal(requests.at(-1).request.reminderEnabled, true)
  assert.equal(requests.at(-1).request.reminderMinutesBefore, 30)
  assert.equal(updated.reminderMinutesBefore, 30)
  assert.equal((await eventApi.getEvents())[0].reminderMinutesBefore, 30)

  const disabled = await eventApi.updateEvent(created.id, {
    ...baseEvent,
    reminderMinutesBefore: null,
  })
  assert.equal(requests.at(-1).request.reminderEnabled, false)
  assert.equal(requests.at(-1).request.reminderMinutesBefore, null)
  assert.equal(disabled.reminderMinutesBefore, null)
  assert.equal((await eventApi.getEvents())[0].reminderMinutesBefore, null)

  const startTimeReminder = eventApi.toEventWriteRequest({
    ...baseEvent,
    reminderMinutesBefore: 0,
  })
  assert.equal(startTimeReminder.reminderEnabled, true)
  assert.equal(startTimeReminder.reminderMinutesBefore, 0)

  const noReminder = await eventApi.createEvent({
    ...baseEvent,
    title: 'PR39 no reminder',
    reminderMinutesBefore: null,
  })
  assert.equal(noReminder.reminderEnabled, false)
  assert.equal(noReminder.reminderMinutesBefore, null)

  for (const invalidValue of [-1, Number.NaN, 10081]) {
    assert.throws(
      () =>
        eventApi.toEventWriteRequest({
          ...baseEvent,
          reminderMinutesBefore: invalidValue,
        }),
      (error) => error instanceof eventApi.ApiError && error.code === 'invalid_reminder',
    )
  }

  console.log('PASS reminder options, labels, validation, create, reload, update, disable, and null/0 mapping')
} finally {
  await server.close()
  globalThis.fetch = originalFetch
}
