#!/usr/bin/env node
/**
 * Drive Chrome Canary / Chrome 154+ with WebMCP flags against the live
 * Chameleon URL. Walks docs/05-demo-script.md twice, then triggers every
 * ErrorCode and follows the hint.
 *
 * executeTool takes a RegisteredTool from getTools() plus a JSON string.
 */
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import path from 'node:path'

const require = createRequire(
  '/workspace/.cursor/skills/verify-chameleon/scripts/control-chameleon.mjs',
)
const { chromium } = require('playwright-core')

const CHROME =
  process.env.CHROME_PATH || '/usr/bin/google-chrome-unstable'
const URL =
  process.env.CHAMELEON_URL ||
  'https://chameleon-webmcp.ryan-970.workers.dev/'
const PROFILE =
  process.env.CHROME_PROFILE || '/tmp/webmcp-canary-audit-profile'
const OUT_DIR = process.env.AUDIT_OUT || '/workspace/.audit'
const EXTENSION = process.env.WEBMCP_EXTENSION || ''

function chromeArgs() {
  const args = [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--enable-features=WebMCP,WebMCPTesting,DevToolsWebMCPSupport',
  ]
  if (EXTENSION) {
    args.push(`--disable-extensions-except=${EXTENSION}`)
    args.push(`--load-extension=${EXTENSION}`)
  }
  return args
}

async function callTool(page, name, args = {}) {
  return page.evaluate(async ({ name, args }) => {
    const ctx = document.modelContext
    if (!ctx) return { _hostError: 'no document.modelContext' }
    const tools = await ctx.getTools()
    const tool = tools.find((candidate) => candidate.name === name)
    if (!tool) {
      return {
        _hostError: `tool not listed: ${name}`,
        available: tools.map((candidate) => candidate.name),
      }
    }
    const raw = await ctx.executeTool(tool, JSON.stringify(args ?? {}))
    let parsed = raw
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw)
      } catch {
        return { _hostError: 'executeTool returned non-JSON', raw }
      }
    }
    if (parsed?.content?.[0]?.text) {
      try {
        return JSON.parse(parsed.content[0].text)
      } catch {
        return { _hostError: 'content text is not JSON', parsed }
      }
    }
    return parsed
  }, { name, args })
}

async function listTools(page) {
  return page.evaluate(async () => {
    const ctx = document.modelContext
    if (!ctx) return []
    const tools = await ctx.getTools()
    return tools.map((tool) => tool.name).sort()
  })
}

async function waitForTool(page, name, timeoutMs = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const names = await listTools(page)
    if (names.includes(name)) return names
    await sleep(200)
  }
  return listTools(page)
}

async function resetCanvas(page) {
  const button = page.getByRole('button', { name: 'Reset canvas' })
  if (await button.count()) {
    await button.click()
    await sleep(400)
  }
}

async function hostCheck(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.getByText('CHAMELEON', { exact: true }).waitFor({
    state: 'visible',
  })
  await sleep(1200)
  return page.evaluate(() => {
    const text = document.body.innerText
    const ctx = document.modelContext
    return {
      userAgent: navigator.userAgent,
      headerViaDocument: /15 tools via document/.test(text),
      headerToolsReady: /15 tools ready/.test(text),
      banner: /WebMCP not detected/.test(text),
      hasDocumentContext: Boolean(ctx),
      methods: ctx
        ? Object.getOwnPropertyNames(Object.getPrototypeOf(ctx))
        : [],
    }
  })
}

const FORM_FIELDS = [
  {
    key: 'reading',
    label: 'Blood sugar (mg/dL)',
    type: 'number',
    required: true,
  },
  {
    key: 'context',
    label: 'When taken',
    type: 'select',
    required: true,
    options: ['fasting', 'before meal', 'after meal', 'bedtime'],
  },
  { key: 'note', label: 'Note', type: 'text', required: false },
]

const MINT_DESCRIPTION =
  'Records one blood-glucose reading in mg/dL with meal context. Example: reading 104, context after meal.'

async function demoWalk(page, label) {
  const started = Date.now()
  const beats = []

  async function beat(name, fn) {
    const t0 = Date.now()
    const result = await fn()
    beats.push({ name, ms: Date.now() - t0, result })
    return result
  }

  await resetCanvas(page)

  const empty = await beat('hook-empty', () =>
    callTool(page, 'describe_current_state', {}),
  )
  if (!empty.ok || empty.board?.widgetCount !== 0) {
    throw new Error(`${label}: board was not empty at start`)
  }

  const checklist = await beat('wedding-checklist', () =>
    callTool(page, 'add_widget', {
      type: 'checklist',
      title: 'Before the venue tour',
      rationale: 'Wedding prep checklist.',
    }),
  )
  await callTool(page, 'add_rows', {
    widgetId: checklist.widgetId,
    rows: [
      { text: 'Book photographer', done: false },
      { text: 'Taste cake', done: false },
    ],
  })

  const guests = await beat('wedding-table', () =>
    callTool(page, 'add_widget', {
      type: 'table',
      title: 'Guest list',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        {
          key: 'rsvp',
          label: 'RSVP',
          type: 'select',
          required: true,
          options: ['yes', 'no', 'pending'],
        },
      ],
      rationale: 'Track 80 guests.',
    }),
  )
  const guestRows = await callTool(page, 'add_rows', {
    widgetId: guests.widgetId,
    rows: [
      { name: 'Avery Chen', rsvp: 'pending' },
      { name: 'Jordan Lee', rsvp: 'yes' },
    ],
  })

  const vendors = await beat('wedding-kanban', () =>
    callTool(page, 'add_widget', {
      type: 'kanban',
      title: 'Vendors',
      fields: [
        { key: 'title', label: 'Vendor', type: 'text', required: true },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          options: ['to research', 'contacted', 'booked'],
        },
      ],
      rationale: 'Vendor pipeline.',
    }),
  )
  await callTool(page, 'add_rows', {
    widgetId: vendors.widgetId,
    rows: [
      { title: 'Florist', status: 'contacted' },
      { title: 'DJ', status: 'to research' },
    ],
  })

  const note = await beat('wedding-note', () =>
    callTool(page, 'add_widget', {
      type: 'note',
      title: 'Budget notes',
      config: { markdown: 'Cap florist at $2k. Venue deposit due March.' },
      rationale: 'Budget scratch pad.',
    }),
  )

  await beat('wedding-layout', () =>
    callTool(page, 'set_layout', {
      items: [
        { widgetId: checklist.widgetId, x: 0, y: 0, w: 4, h: 8 },
        { widgetId: guests.widgetId, x: 4, y: 0, w: 8, h: 8 },
        { widgetId: vendors.widgetId, x: 0, y: 8, w: 8, h: 10 },
        { widgetId: note.widgetId, x: 8, y: 8, w: 4, h: 10 },
      ],
      rationale: 'Checklist and guests on top, vendors wide below.',
    }),
  )

  await beat('human-rsvp', () =>
    callTool(page, 'update_rows', {
      widgetId: guests.widgetId,
      patches: [{ rowId: guestRows.rowIds[0], set: { rsvp: 'yes' } }],
      rationale: 'Human changed Avery RSVP.',
    }),
  )
  const activity = await beat('what-changed', () =>
    callTool(page, 'get_activity_log', { limit: 10 }),
  )

  await resetCanvas(page)

  const jobsKanban = await beat('jobs-kanban', () =>
    callTool(page, 'add_widget', {
      type: 'kanban',
      title: 'Pipeline',
      fields: [
        { key: 'title', label: 'Role', type: 'text', required: true },
        {
          key: 'status',
          label: 'Stage',
          type: 'select',
          required: true,
          options: ['applied', 'screen', 'onsite', 'offer'],
        },
      ],
    }),
  )
  await callTool(page, 'add_rows', {
    widgetId: jobsKanban.widgetId,
    rows: [{ title: 'Staff engineer, Ribbon', status: 'applied' }],
  })
  const contacts = await beat('jobs-contacts', () =>
    callTool(page, 'add_widget', {
      type: 'table',
      title: 'Contacts',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'company', label: 'Company', type: 'text', required: true },
      ],
    }),
  )
  await callTool(page, 'add_rows', {
    widgetId: contacts.widgetId,
    rows: [{ name: 'Sam Patel', company: 'Ribbon' }],
  })
  const weekly = await beat('jobs-checklist', () =>
    callTool(page, 'add_widget', {
      type: 'checklist',
      title: 'Weekly goals',
    }),
  )
  await callTool(page, 'add_rows', {
    widgetId: weekly.widgetId,
    rows: [{ text: 'Apply to three roles', done: false }],
  })
  await beat('jobs-theme', () =>
    callTool(page, 'set_theme', {
      boardTitle: 'Job search',
      theme: 'neutral',
      mode: 'dark',
      density: 'compact',
      rationale: 'Dark compact for a tracker.',
    }),
  )

  await resetCanvas(page)

  const form = await beat('health-form', () =>
    callTool(page, 'add_widget', {
      type: 'form',
      title: 'Blood sugar log',
      fields: FORM_FIELDS,
      rationale: 'Log readings.',
    }),
  )
  await beat('health-chart', () =>
    callTool(page, 'add_widget', {
      type: 'chart',
      title: 'Glucose trend',
      fields: [
        { key: 'reading', label: 'Reading', type: 'number', required: true },
      ],
      config: {
        chartType: 'line',
        xField: '_createdAt',
        yFields: ['reading'],
        aggregate: 'none',
      },
    }),
  )
  const minted = await beat('mint', () =>
    callTool(page, 'create_form_tool', {
      widgetId: form.widgetId,
      toolName: 'log_blood_sugar',
      description: MINT_DESCRIPTION,
      rationale: 'Mint the logging shortcut.',
    }),
  )
  const afterMint = await waitForTool(page, 'log_blood_sugar')
  const logged = await beat('minted-call', () =>
    callTool(page, 'log_blood_sugar', {
      reading: 104,
      context: 'after meal',
    }),
  )

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByText('CHAMELEON', { exact: true }).waitFor({
    state: 'visible',
  })
  await sleep(1200)
  const afterReload = await waitForTool(page, 'log_blood_sugar')
  const loggedAgain = await beat('minted-after-reload', () =>
    callTool(page, 'log_blood_sugar', {
      reading: 96,
      context: 'fasting',
    }),
  )
  const undone = await beat('undo', () => callTool(page, 'undo', {}))

  return {
    label,
    ms: Date.now() - started,
    emptyWidgetCount: empty.board.widgetCount,
    activityOk: activity.ok === true,
    mintOk: minted.ok === true,
    mintedListed: afterMint.includes('log_blood_sugar'),
    mintedAfterReload: afterReload.includes('log_blood_sugar'),
    mintedCallOk: logged.ok === true,
    mintedReloadCallOk: loggedAgain.ok === true,
    undoOk: undone.ok === true,
    beats: beats.map((beatRow) => ({
      name: beatRow.name,
      ms: beatRow.ms,
      ok: beatRow.result?.ok !== false && !beatRow.result?._hostError,
      error: beatRow.result?.error || beatRow.result?._hostError,
    })),
  }
}

function hintTools(hint) {
  const names = [
    'describe_current_state',
    'read_widget_data',
    'bind_data',
    'add_rows',
    'remove_widget',
    'delete_rows',
    'remove_minted_tool',
    'create_form_tool',
    'update_widget',
    'add_widget',
  ]
  return names.filter((name) => hint.includes(name))
}

async function errorAudit(page) {
  const rows = []

  async function record(code, trigger, recovery) {
    const hint = trigger?.error?.hint ?? ''
    const named = hintTools(hint)
    rows.push({
      code,
      triggerTool: trigger._tool,
      triggerOk: trigger.ok,
      gotCode: trigger.error?.code,
      hint,
      namedRecoveryTools: named,
      recovery,
      recovered: recovery.recovered,
      flag:
        trigger.error?.code !== code
          ? 'did-not-trigger'
          : recovery.recovered
            ? 'ok'
            : 'hint-does-not-recover',
    })
  }

  await resetCanvas(page)

  // INVALID_INPUT
  {
    const trigger = await callTool(page, 'add_widget', { type: 'note' })
    trigger._tool = 'add_widget'
    const retry = await callTool(page, 'add_widget', {
      type: 'note',
      title: 'Scratch',
    })
    await record('INVALID_INPUT', trigger, {
      recovered: retry.ok === true,
      steps: ['retried add_widget with title'],
      retryOk: retry.ok,
    })
    if (retry.widgetId) {
      await callTool(page, 'remove_widget', { widgetId: retry.widgetId })
    }
  }

  // INVALID_CONFIG
  {
    const trigger = await callTool(page, 'add_widget', {
      type: 'note',
      title: 'Too long',
      config: { variant: 'poster' },
    })
    trigger._tool = 'add_widget'
    const described = await callTool(page, 'describe_current_state', {})
    const retry = await callTool(page, 'add_widget', {
      type: 'note',
      title: 'Too long',
      config: { variant: 'plain', markdown: 'Venue deposit due March.' },
    })
    await record('INVALID_CONFIG', trigger, {
      recovered: retry.ok === true && described.ok === true,
      steps: ['describe_current_state', 'retry add_widget with note config'],
      retryOk: retry.ok,
    })
    if (retry.widgetId) {
      await callTool(page, 'remove_widget', { widgetId: retry.widgetId })
    }
  }

  // INVALID_ROWS
  {
    const table = await callTool(page, 'add_widget', {
      type: 'table',
      title: 'RSVPs',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        {
          key: 'count',
          label: 'Count',
          type: 'number',
          required: true,
        },
      ],
    })
    const trigger = await callTool(page, 'add_rows', {
      widgetId: table.widgetId,
      rows: [{ name: 'Avery', count: 'not-a-number' }],
    })
    trigger._tool = 'add_rows'
    const retry = await callTool(page, 'add_rows', {
      widgetId: table.widgetId,
      rows: [{ name: 'Avery', count: 2 }],
    })
    await record('INVALID_ROWS', trigger, {
      recovered: retry.ok === true,
      steps: ['fixed row types and retried add_rows'],
      retryOk: retry.ok,
    })
    await callTool(page, 'remove_widget', { widgetId: table.widgetId })
  }

  // WIDGET_NOT_FOUND
  {
    const trigger = await callTool(page, 'update_widget', {
      widgetId: 'w_missing999',
      title: 'Gone',
    })
    trigger._tool = 'update_widget'
    const described = await callTool(page, 'describe_current_state', {})
    const added = await callTool(page, 'add_widget', {
      type: 'note',
      title: 'Present',
    })
    const retry = await callTool(page, 'update_widget', {
      widgetId: added.widgetId,
      title: 'Renamed',
    })
    await record('WIDGET_NOT_FOUND', trigger, {
      recovered: described.ok === true && retry.ok === true,
      steps: ['describe_current_state', 'update_widget on a live id'],
      retryOk: retry.ok,
    })
    await callTool(page, 'remove_widget', { widgetId: added.widgetId })
  }

  // WRONG_WIDGET_TYPE
  {
    const note = await callTool(page, 'add_widget', {
      type: 'note',
      title: 'Prose',
      config: { markdown: 'Hello' },
    })
    const trigger = await callTool(page, 'bind_data', {
      widgetId: note.widgetId,
      fields: [{ key: 'name', label: 'Name', type: 'text' }],
    })
    trigger._tool = 'bind_data'
    const described = await callTool(page, 'describe_current_state', {})
    const table = await callTool(page, 'add_widget', {
      type: 'table',
      title: 'Names',
    })
    const retry = await callTool(page, 'bind_data', {
      widgetId: table.widgetId,
      fields: [{ key: 'name', label: 'Name', type: 'text' }],
    })
    await record('WRONG_WIDGET_TYPE', trigger, {
      recovered: described.ok === true && retry.ok === true,
      steps: [
        'describe_current_state',
        'bind_data on a table instead of the note',
      ],
      retryOk: retry.ok,
    })
    await callTool(page, 'remove_widget', { widgetId: note.widgetId })
    await callTool(page, 'remove_widget', { widgetId: table.widgetId })
  }

  // ROW_NOT_FOUND
  {
    const table = await callTool(page, 'add_widget', {
      type: 'table',
      title: 'People',
      fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
    })
    const added = await callTool(page, 'add_rows', {
      widgetId: table.widgetId,
      rows: [{ name: 'Avery' }],
    })
    const trigger = await callTool(page, 'update_rows', {
      widgetId: table.widgetId,
      patches: [{ rowId: 'row_does_not_exist', set: { name: 'Jordan' } }],
    })
    trigger._tool = 'update_rows'
    const read = await callTool(page, 'read_widget_data', {
      widgetId: table.widgetId,
    })
    const liveId = read.rows?.[0]?._id ?? added.rowIds?.[0]
    const retry = await callTool(page, 'update_rows', {
      widgetId: table.widgetId,
      patches: [{ rowId: liveId, set: { name: 'Jordan' } }],
    })
    await record('ROW_NOT_FOUND', trigger, {
      recovered: read.ok === true && retry.ok === true,
      steps: ['read_widget_data', 'update_rows with copied _id'],
      retryOk: retry.ok,
    })
    await callTool(page, 'remove_widget', { widgetId: table.widgetId })
  }

  // NO_FIELDS_BOUND
  {
    const table = await callTool(page, 'add_widget', {
      type: 'table',
      title: 'Empty schema',
    })
    const trigger = await callTool(page, 'add_rows', {
      widgetId: table.widgetId,
      rows: [{ name: 'Avery' }],
    })
    trigger._tool = 'add_rows'
    const bound = await callTool(page, 'bind_data', {
      widgetId: table.widgetId,
      fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
    })
    const retry = await callTool(page, 'add_rows', {
      widgetId: table.widgetId,
      rows: [{ name: 'Avery' }],
    })
    await record('NO_FIELDS_BOUND', trigger, {
      recovered: bound.ok === true && retry.ok === true,
      steps: ['bind_data', 'add_rows'],
      retryOk: retry.ok,
    })
    await callTool(page, 'remove_widget', { widgetId: table.widgetId })
  }

  // FIELD_NOT_FOUND
  {
    const trigger = await callTool(page, 'add_widget', {
      type: 'table',
      title: 'Broken sort',
      fields: [{ key: 'name', label: 'Name', type: 'text' }],
      config: { sort: { field: 'missing', dir: 'asc' } },
    })
    trigger._tool = 'add_widget'
    const described = await callTool(page, 'describe_current_state', {})
    const retry = await callTool(page, 'add_widget', {
      type: 'table',
      title: 'Broken sort',
      fields: [{ key: 'name', label: 'Name', type: 'text' }],
      config: { sort: { field: 'name', dir: 'asc' } },
    })
    await record('FIELD_NOT_FOUND', trigger, {
      recovered: described.ok === true && retry.ok === true,
      steps: ['describe_current_state', 'retry with listed key name'],
      retryOk: retry.ok,
    })
    if (retry.widgetId) {
      await callTool(page, 'remove_widget', { widgetId: retry.widgetId })
    }
  }

  // NAME_TAKEN + RESERVED_NAME + TOOL_NOT_FOUND
  {
    const form = await callTool(page, 'add_widget', {
      type: 'form',
      title: 'Blood sugar log',
      fields: FORM_FIELDS,
    })
    const reserved = await callTool(page, 'create_form_tool', {
      widgetId: form.widgetId,
      toolName: 'add_widget',
      description: MINT_DESCRIPTION,
    })
    reserved._tool = 'create_form_tool'
    const renamed = await callTool(page, 'create_form_tool', {
      widgetId: form.widgetId,
      toolName: 'log_blood_sugar',
      description: MINT_DESCRIPTION,
    })
    await record('RESERVED_NAME', reserved, {
      recovered: renamed.ok === true,
      steps: ['chose log_blood_sugar instead of add_widget'],
      retryOk: renamed.ok,
    })

    const taken = await callTool(page, 'create_form_tool', {
      widgetId: form.widgetId,
      toolName: 'log_blood_sugar',
      description: MINT_DESCRIPTION,
    })
    taken._tool = 'create_form_tool'
    const removed = await callTool(page, 'remove_minted_tool', {
      toolName: 'log_blood_sugar',
    })
    const remint = await callTool(page, 'create_form_tool', {
      widgetId: form.widgetId,
      toolName: 'log_blood_sugar',
      description: MINT_DESCRIPTION,
    })
    await record('NAME_TAKEN', taken, {
      recovered: removed.ok === true && remint.ok === true,
      steps: ['remove_minted_tool', 'create_form_tool again'],
      retryOk: remint.ok,
    })

    const missingMint = await callTool(page, 'remove_minted_tool', {
      toolName: 'log_ghost_entry',
    })
    missingMint._tool = 'remove_minted_tool'
    const described = await callTool(page, 'describe_current_state', {})
    const liveName = described.mintedTools?.[0]?.toolName
    const removeLive = liveName
      ? await callTool(page, 'remove_minted_tool', { toolName: liveName })
      : { ok: false }
    await record('TOOL_NOT_FOUND', missingMint, {
      recovered: described.ok === true && removeLive.ok === true,
      steps: [
        'describe_current_state listed minted tools',
        'remove_minted_tool on the live name',
      ],
      retryOk: removeLive.ok,
    })
    await callTool(page, 'remove_widget', { widgetId: form.widgetId })
  }

  // NO_CHANGES
  {
    const note = await callTool(page, 'add_widget', {
      type: 'note',
      title: 'Static',
    })
    const trigger = await callTool(page, 'update_widget', {
      widgetId: note.widgetId,
    })
    trigger._tool = 'update_widget'
    const retry = await callTool(page, 'update_widget', {
      widgetId: note.widgetId,
      title: 'Edited',
    })
    await record('NO_CHANGES', trigger, {
      recovered: retry.ok === true,
      steps: ['retried update_widget with title'],
      retryOk: retry.ok,
    })
    await callTool(page, 'remove_widget', { widgetId: note.widgetId })
  }

  // NOTHING_TO_UNDO
  {
    await resetCanvas(page)
    const trigger = await callTool(page, 'undo', {})
    trigger._tool = 'undo'
    const described = await callTool(page, 'describe_current_state', {})
    const emptyLog = (described.recentActivity ?? []).length === 0
    await record('NOTHING_TO_UNDO', trigger, {
      recovered: emptyLog,
      steps: [
        'hint says the log is empty; describe_current_state confirmed 0 commands',
      ],
      emptyLog,
    })
  }

  // DUPLICATE_ID
  {
    const a = await callTool(page, 'add_widget', {
      type: 'note',
      title: 'Left',
    })
    const b = await callTool(page, 'add_widget', {
      type: 'note',
      title: 'Right',
    })
    const trigger = await callTool(page, 'set_layout', {
      items: [
        { widgetId: a.widgetId, x: 0, y: 0, w: 4, h: 4 },
        { widgetId: a.widgetId, x: 4, y: 0, w: 4, h: 4 },
      ],
    })
    trigger._tool = 'set_layout'
    const retry = await callTool(page, 'set_layout', {
      items: [
        { widgetId: a.widgetId, x: 0, y: 0, w: 4, h: 4 },
        { widgetId: b.widgetId, x: 4, y: 0, w: 4, h: 4 },
      ],
    })
    await record('DUPLICATE_ID', trigger, {
      recovered: retry.ok === true,
      steps: ['retried set_layout with each widget once'],
      retryOk: retry.ok,
    })
    await callTool(page, 'remove_widget', { widgetId: a.widgetId })
    await callTool(page, 'remove_widget', { widgetId: b.widgetId })
  }

  // LIMIT_EXCEEDED — widgetsPerBoard
  {
    await resetCanvas(page)
    const ids = []
    for (let i = 0; i < 24; i += 1) {
      const added = await callTool(page, 'add_widget', {
        type: 'note',
        title: `N${i}`,
      })
      if (added.widgetId) ids.push(added.widgetId)
    }
    const trigger = await callTool(page, 'add_widget', {
      type: 'note',
      title: 'Overflow',
    })
    trigger._tool = 'add_widget'
    const removed = await callTool(page, 'remove_widget', {
      widgetId: ids[0],
    })
    const retry = await callTool(page, 'add_widget', {
      type: 'note',
      title: 'Overflow',
    })
    await record('LIMIT_EXCEEDED', trigger, {
      recovered: removed.ok === true && retry.ok === true,
      steps: ['remove_widget', 'retry add_widget'],
      retryOk: retry.ok,
      details: trigger.error?.details,
    })
  }

  return rows
}

const context = await chromium.launchPersistentContext(PROFILE, {
  executablePath: CHROME,
  headless: process.env.HEADED === '1' ? false : true,
  args: chromeArgs(),
  viewport: { width: 1400, height: 900 },
})
const page = context.pages()[0] ?? (await context.newPage())

try {
  const host = await hostCheck(page)
  const tools = await listTools(page)
  console.error('host', JSON.stringify(host))
  console.error('tools', tools.join(','))

  const demo1 = await demoWalk(page, 'walk-1')
  console.error('demo1', demo1.ms, 'ms minted', demo1.mintedListed, demo1.mintedAfterReload)
  const demo2 = await demoWalk(page, 'walk-2')
  console.error('demo2', demo2.ms, 'ms minted', demo2.mintedListed, demo2.mintedAfterReload)

  const errors = await errorAudit(page)
  const failed = errors.filter((row) => row.flag !== 'ok')

  const report = {
    when: new Date().toISOString(),
    chrome: CHROME,
    url: URL,
    extension: EXTENSION || null,
    host,
    staticTools: tools,
    demo: [demo1, demo2],
    errors,
    failedCodes: failed.map((row) => row.code),
  }

  await mkdir(OUT_DIR, { recursive: true })
  const jsonPath = path.join(OUT_DIR, 'canary-dress-rehearsal.json')
  await writeFile(jsonPath, JSON.stringify(report, null, 2))
  const tsv = [
    'code\tgotCode\tflag\tnamedRecoveryTools\trecovered\thint',
    ...errors.map(
      (row) =>
        `${row.code}\t${row.gotCode}\t${row.flag}\t${row.namedRecoveryTools.join('|')}\t${row.recovered}\t${(row.hint || '').replaceAll('\t', ' ')}`,
    ),
  ].join('\n')
  await writeFile(path.join(OUT_DIR, 'canary-error-audit.tsv'), `${tsv}\n`)
  console.log(JSON.stringify({
    jsonPath,
    demo1ms: demo1.ms,
    demo2ms: demo2.ms,
    failedCodes: report.failedCodes,
    errorCount: errors.length,
  }, null, 2))
} finally {
  await context.close()
}
