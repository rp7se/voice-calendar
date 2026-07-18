import assert from 'node:assert/strict'
import { existsSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const executable = path.join(
  repositoryRoot,
  'backend',
  'build',
  'Debug',
  'voicecalendar_backend.exe',
)
const defaultDatabase = path.join(repositoryRoot, 'backend', 'data', 'voicecalendar.db')
const testDatabase = path.join(repositoryRoot, 'backend', 'data', 'pr40-infrastructure-test.db')
const configurationNames = [
  'VOICECALENDAR_HOST',
  'VOICECALENDAR_PORT',
  'VOICECALENDAR_DB_PATH',
  'VOICECALENDAR_REMINDER_SCAN_SECONDS',
]

function cleanEnvironment(overrides = {}) {
  const environment = { ...process.env }
  for (const name of configurationNames) {
    delete environment[name]
  }
  return { ...environment, ...overrides }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function waitForExit(child, timeoutMilliseconds = 5000) {
  const deadline = Date.now() + timeoutMilliseconds
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return child.exitCode
    await delay(25)
  }
  return child.exitCode
}

async function startBackend(overrides, port, cwd = repositoryRoot) {
  const child = spawn(executable, [], {
    cwd,
    env: cleanEnvironment(overrides),
    windowsHide: true,
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })

  const baseUrl = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Backend exited before becoming ready (${child.exitCode}):\n${output}`)
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.status === 200) {
        return { child, baseUrl, getOutput: () => output }
      }
    } catch {
      // Listener is not ready yet.
    }
    await delay(100)
  }
  child.kill()
  throw new Error(`Backend did not become ready:\n${output}`)
}

async function stopBackend(server) {
  if (!server || server.child.exitCode !== null) return
  const signalSent = server.child.kill()
  assert.equal(signalSent, true, 'Backend process did not accept the stop signal')
  await delay(250)
}

async function expectStartupFailure(overrides, expectedText) {
  const child = spawn(executable, [], {
    cwd: repositoryRoot,
    env: cleanEnvironment(overrides),
    windowsHide: true,
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })
  const exitCode = await waitForExit(child)
  if (exitCode === null) {
    child.kill()
    throw new Error(`Invalid configuration did not stop startup:\n${output}`)
  }
  assert.notEqual(exitCode, 0)
  assert.match(output, new RegExp(expectedText))
}

async function request(baseUrl, route, options) {
  return fetch(`${baseUrl}${route}`, options)
}

async function requestJson(baseUrl, route, options) {
  const response = await request(baseUrl, route, options)
  const body = response.status === 204 ? null : await response.json()
  return { response, body }
}

function jsonOptions(method, body) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function assertError(result, status, code) {
  assert.equal(result.response.status, status)
  assert.equal(result.body.error, code)
  assert.equal(typeof result.body.message, 'string')
  assert.ok(result.body.message.length > 0)
}

function localDateTime() {
  const now = new Date()
  return {
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  }
}

async function readReminder(reader, eventId) {
  const decoder = new TextDecoder()
  let content = ''
  const deadline = Date.now() + 12000
  while (Date.now() < deadline) {
    const result = await Promise.race([
      reader.read(),
      delay(12000).then(() => ({ done: true, value: undefined })),
    ])
    if (result.done) break
    content += decoder.decode(result.value, { stream: true })
    if (content.includes(`\"eventId\":\"${eventId}\"`)) return content
  }
  throw new Error(`Reminder SSE delivery was not received for event ${eventId}`)
}

for (const suffix of ['', '-wal', '-shm', '-journal']) {
  rmSync(`${testDatabase}${suffix}`, { force: true })
}

let server
try {
  assert.ok(existsSync(defaultDatabase), 'Existing default database must exist before compatibility test')

  server = await startBackend({}, 8080, os.tmpdir())
  const health = await requestJson(server.baseUrl, '/api/health')
  assert.equal(health.response.status, 200)
  for (const route of ['/api/events', '/api/tasks', '/api/categories', '/api/reminders/pending']) {
    const result = await requestJson(server.baseUrl, route)
    assert.equal(result.response.status, 200)
    assert.ok(Array.isArray(result.body))
  }
  await stopBackend(server)
  server = undefined

  await expectStartupFailure({ VOICECALENDAR_PORT: 'abc' }, 'VOICECALENDAR_PORT')
  await expectStartupFailure({ VOICECALENDAR_PORT: '0' }, 'VOICECALENDAR_PORT')
  await expectStartupFailure({ VOICECALENDAR_PORT: '70000' }, 'VOICECALENDAR_PORT')
  await expectStartupFailure({ VOICECALENDAR_REMINDER_SCAN_SECONDS: '0' }, 'VOICECALENDAR_REMINDER_SCAN_SECONDS')
  await expectStartupFailure({ VOICECALENDAR_REMINDER_SCAN_SECONDS: '-1' }, 'VOICECALENDAR_REMINDER_SCAN_SECONDS')
  await expectStartupFailure({ VOICECALENDAR_REMINDER_SCAN_SECONDS: 'abc' }, 'VOICECALENDAR_REMINDER_SCAN_SECONDS')

  server = await startBackend({
    VOICECALENDAR_PORT: '18081',
    VOICECALENDAR_DB_PATH: 'backend/data/pr40-infrastructure-test.db',
    VOICECALENDAR_REMINDER_SCAN_SECONDS: '2',
  }, 18081)

  assertError(
    await requestJson(server.baseUrl, '/api/events', jsonOptions('POST', {})),
    400,
    'invalid_event',
  )
  assertError(await requestJson(server.baseUrl, '/api/events/missing'), 404, 'event_not_found')

  const eventInput = {
    title: 'PR40 event',
    description: '',
    date: '2099-08-20',
    startTime: '10:00',
    endTime: '11:00',
    type: 'schedule',
    reminderEnabled: false,
    reminderMinutesBefore: null,
  }
  const createdEvent = await requestJson(
    server.baseUrl,
    '/api/events',
    jsonOptions('POST', eventInput),
  )
  assert.equal(createdEvent.response.status, 201)
  const conflict = await requestJson(
    server.baseUrl,
    '/api/events',
    jsonOptions('POST', { ...eventInput, title: 'PR40 conflict' }),
  )
  assertError(conflict, 409, 'event_conflict')
  assert.ok(Array.isArray(conflict.body.conflicts))
  assert.ok(conflict.body.conflicts.length > 0)

  assertError(await requestJson(server.baseUrl, '/api/tasks/missing'), 404, 'task_not_found')
  const task = await requestJson(
    server.baseUrl,
    '/api/tasks',
    jsonOptions('POST', {
      title: 'PR40 task',
      status: 'pending',
      priority: 'high',
      estimatedDurationMinutes: 30,
    }),
  )
  assert.equal(task.response.status, 201)
  const linked = await requestJson(
    server.baseUrl,
    `/api/tasks/${task.body.id}/scheduling`,
    jsonOptions('PUT', { eventId: createdEvent.body.id }),
  )
  assert.equal(linked.response.status, 200)
  assertError(
    await requestJson(
      server.baseUrl,
      `/api/tasks/${task.body.id}/scheduling`,
      jsonOptions('PUT', { eventId: createdEvent.body.id }),
    ),
    409,
    'task_already_scheduled',
  )

  const category = await requestJson(
    server.baseUrl,
    '/api/categories',
    jsonOptions('POST', { name: 'PR40 category' }),
  )
  assert.equal(category.response.status, 201)
  assertError(
    await requestJson(
      server.baseUrl,
      '/api/categories',
      jsonOptions('POST', { name: 'PR40 category' }),
    ),
    409,
    'category_name_conflict',
  )

  assertError(
    await requestJson(server.baseUrl, '/api/reminders/missing/ack', { method: 'POST' }),
    404,
    'reminder_not_found',
  )
  assertError(
    await requestJson(
      server.baseUrl,
      '/api/scheduling/preview',
      jsonOptions('POST', {}),
    ),
    400,
    'invalid_scheduling_request',
  )

  const freeTime = await requestJson(
    server.baseUrl,
    '/api/free-time?date=2099-08-20&start=08:00&end=18:00',
  )
  assert.equal(freeTime.response.status, 200)
  assert.ok(Array.isArray(freeTime.body.freeSlots))
  const preview = await requestJson(
    server.baseUrl,
    '/api/scheduling/preview',
    jsonOptions('POST', {
      date: '2099-08-20',
      range: { start: '08:00', end: '18:00' },
      tasks: [{
        id: 'preview-task',
        title: 'Preview task',
        status: 'pending',
        priority: 'medium',
        estimatedDurationMinutes: 30,
      }],
    }),
  )
  assert.equal(preview.response.status, 200)
  assert.equal(preview.body.summary.totalTasks, 1)

  const streamAbort = new AbortController()
  const streamResponse = await request(server.baseUrl, '/api/reminders/stream', {
    signal: streamAbort.signal,
  })
  assert.equal(streamResponse.status, 200)
  assert.ok(streamResponse.body)
  const reader = streamResponse.body.getReader()
  const now = localDateTime()
  const noReminder = await requestJson(
    server.baseUrl,
    '/api/events',
    jsonOptions('POST', {
      ...eventInput,
      title: 'PR40 no reminder',
      date: now.date,
      startTime: now.time,
      endTime: null,
    }),
  )
  const reminderEvent = await requestJson(
    server.baseUrl,
    '/api/events',
    jsonOptions('POST', {
      ...eventInput,
      title: 'PR40 reminder',
      date: now.date,
      startTime: now.time,
      endTime: null,
      reminderEnabled: true,
      reminderMinutesBefore: 0,
    }),
  )
  const streamContent = await readReminder(reader, reminderEvent.body.id)
  assert.match(streamContent, /event: reminder/)
  streamAbort.abort()

  const pending = await requestJson(server.baseUrl, '/api/reminders/pending')
  const delivery = pending.body.find((item) => item.eventId === reminderEvent.body.id)
  assert.ok(delivery)
  assert.equal(pending.body.some((item) => item.eventId === noReminder.body.id), false)
  const acknowledged = await requestJson(
    server.baseUrl,
    `/api/reminders/${delivery.id}/ack`,
    { method: 'POST' },
  )
  assert.equal(acknowledged.response.status, 200)
  assert.equal(acknowledged.body.status, 'acknowledged')

  const updatedCategory = await requestJson(
    server.baseUrl,
    `/api/categories/${category.body.id}`,
    jsonOptions('PUT', { name: 'PR40 category updated' }),
  )
  assert.equal(updatedCategory.response.status, 200)
  const updatedTask = await requestJson(
    server.baseUrl,
    `/api/tasks/${task.body.id}`,
    jsonOptions('PUT', {
      title: 'PR40 task updated',
      status: 'completed',
      priority: 'medium',
    }),
  )
  assert.equal(updatedTask.response.status, 200)
  const updatedEvent = await requestJson(
    server.baseUrl,
    `/api/events/${createdEvent.body.id}`,
    jsonOptions('PUT', { ...eventInput, title: 'PR40 event updated', startTime: '12:00', endTime: '13:00' }),
  )
  assert.equal(updatedEvent.response.status, 200)

  assert.equal((await request(server.baseUrl, `/api/tasks/${task.body.id}`, { method: 'DELETE' })).status, 204)
  assert.equal((await request(server.baseUrl, `/api/categories/${category.body.id}`, { method: 'DELETE' })).status, 204)
  assert.equal((await request(server.baseUrl, `/api/events/${createdEvent.body.id}`, { method: 'DELETE' })).status, 204)

  console.log('PASS configuration cases 1-5, database compatibility, API errors, CRUD, scheduling, Reminder/SSE/ACK')
} finally {
  await stopBackend(server)
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    rmSync(`${testDatabase}${suffix}`, { force: true })
  }
}
