#!/usr/bin/env node
/**
 * Record the Day 6 demo (docs/05 Canary fallback): Chrome 154 + WebMCP,
 * tool-call HUD, paced to the neural voiceover in /tmp/chameleon-demo/vo.
 */
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(fileURLToPath(import.meta.url))
const { chromium } = require('playwright-core')

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-unstable'
const URL =
  process.env.CHAMELEON_URL ||
  'https://chameleon-webmcp.ryan-970.workers.dev/'
const OUT = process.env.DEMO_OUT || '/tmp/chameleon-demo'
const ARTIFACTS = '/opt/cursor/artifacts'
const GALLERY = process.env.DEMO_GALLERY || '/workspace/docs/gallery'

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

const BEATS = [
  { id: '01-hook', ms: 14360, caption: 'A blank page. The agent will build every feature.' },
  { id: '02-setup', ms: 8920, caption: 'document.modelContext is how the agent sees this tab.' },
  { id: '03-wedding', ms: 19640, caption: 'Six widget types. Real fields, real rows, live layout.' },
  { id: '04-human', ms: 17120, caption: 'Human edits share the same command log as the agent.' },
  { id: '05-jobs', ms: 13410, caption: 'Same URL. Different product. Theme included.' },
  { id: '06-health', ms: 7570, caption: 'A form and a chart for a health log.' },
  { id: '07-mint', ms: 20380, caption: 'The app registered a new tool: log_blood_sugar.' },
  { id: '08-persist', ms: 16380, caption: 'Minted tools survive reload. One sentence logs a row.' },
  { id: '09-undo', ms: 12040, caption: 'One command log. Undo works for both of us.' },
]

async function callTool(page, name, args = {}) {
  return page.evaluate(async ({ name, args }) => {
    const ctx = document.modelContext
    if (!ctx) return { _hostError: 'no document.modelContext' }
    const tools = await ctx.getTools()
    const tool = tools.find((candidate) => candidate.name === name)
    if (!tool) {
      return { _hostError: `tool not listed: ${name}` }
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
        return { _hostError: 'content text is not JSON' }
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
    return tools.map((tool) => tool.name)
  })
}

async function waitForTool(page, name, timeoutMs = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const names = await listTools(page)
    if (names.includes(name)) return names
    await sleep(150)
  }
  return listTools(page)
}

async function installHud(page) {
  await page.evaluate(() => {
    const existing = document.getElementById('chameleon-demo-hud')
    if (existing) existing.remove()
    const style = document.createElement('style')
    style.textContent = `
      #chameleon-demo-hud {
        position: fixed;
        top: 12px;
        right: 12px;
        width: 340px;
        z-index: 99999;
        background: color-mix(in srgb, var(--color-background, #16141a) 92%, black);
        color: var(--color-foreground, #f4f1ea);
        border: 1px solid var(--color-border, #3a3630);
        border-radius: 12px;
        padding: 14px 16px;
        font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
        box-shadow: 0 12px 40px rgb(0 0 0 / 35%);
        pointer-events: none;
      }
      #chameleon-demo-hud .hud-kicker {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.7;
        margin-bottom: 6px;
      }
      #chameleon-demo-hud .hud-count { font-weight: 700; margin-bottom: 8px; }
      #chameleon-demo-hud .hud-prompt {
        min-height: 2.6em;
        margin: 8px 0 10px;
        color: var(--color-accent, #c9a227);
      }
      #chameleon-demo-hud ol {
        margin: 0;
        padding-left: 18px;
        max-height: 280px;
        overflow: hidden;
      }
      #chameleon-demo-hud li { margin: 3px 0; }
      #chameleon-demo-hud li.live { color: var(--color-accent, #c9a227); }
      #chameleon-demo-caption {
        position: fixed;
        left: 40px;
        right: 380px;
        bottom: 28px;
        z-index: 99999;
        background: rgb(0 0 0 / 72%);
        color: #fff;
        padding: 12px 18px;
        border-radius: 10px;
        font: 20px/1.35 "Iowan Old Style", Georgia, serif;
        pointer-events: none;
      }
    `
    document.head.appendChild(style)
    const hud = document.createElement('aside')
    hud.id = 'chameleon-demo-hud'
    hud.innerHTML = `
      <div class="hud-kicker">document.modelContext</div>
      <div class="hud-count">tools</div>
      <div class="hud-prompt"></div>
      <ol></ol>
    `
    document.body.appendChild(hud)
    const caption = document.createElement('div')
    caption.id = 'chameleon-demo-caption'
    document.body.appendChild(caption)
    window.__demoHud = {
      setCount(n) {
        hud.querySelector('.hud-count').textContent = `${n} tools`
      },
      setPrompt(text) {
        hud.querySelector('.hud-prompt').textContent = text
      },
      logCall(name, detail) {
        const list = hud.querySelector('ol')
        for (const item of list.querySelectorAll('li.live')) item.classList.remove('live')
        const li = document.createElement('li')
        li.className = 'live'
        li.textContent = detail ? `${name}  ${detail}` : name
        list.appendChild(li)
        while (list.children.length > 12) list.removeChild(list.firstChild)
      },
      setCaption(text) {
        caption.textContent = text
      },
    }
  })
  await refreshToolCount(page)
}

async function refreshToolCount(page) {
  const names = await listTools(page)
  await page.evaluate((n) => window.__demoHud?.setCount(n), names.length)
  return names
}

async function hud(page, method, ...args) {
  await page.evaluate(({ method, args }) => {
    window.__demoHud?.[method]?.(...args)
  }, { method, args })
}

async function agentCall(page, name, args, detail) {
  await hud(page, 'logCall', name, detail || '')
  const result = await callTool(page, name, args)
  await refreshToolCount(page)
  if (result?._hostError || result?.ok === false) {
    throw new Error(`${name} failed: ${JSON.stringify(result)}`)
  }
  await sleep(280)
  return result
}

async function hold(ms) {
  await sleep(ms)
}

async function typePrompt(page, text) {
  let shown = ''
  for (const char of text) {
    shown += char
    await hud(page, 'setPrompt', shown)
    await sleep(18)
  }
}

async function resetCanvas(page) {
  await page.getByRole('button', { name: 'Reset canvas' }).click()
  await page.getByRole('button', { name: 'Reset workspace' }).click()
  await sleep(500)
}

await mkdir(OUT, { recursive: true })
await mkdir(ARTIFACTS, { recursive: true })
await mkdir(GALLERY, { recursive: true })
await mkdir(join(OUT, 'video'), { recursive: true })

const context = await chromium.launchPersistentContext(join(OUT, 'chrome-profile'), {
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--enable-features=WebMCP,WebMCPTesting,DevToolsWebMCPSupport',
  ],
  viewport: { width: 1920, height: 1080 },
  recordVideo: {
    dir: join(OUT, 'video'),
    size: { width: 1920, height: 1080 },
  },
})

const page = context.pages()[0] ?? (await context.newPage())
const videoOrigin = Date.now()
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.getByText('CHAMELEON', { exact: true }).waitFor({ state: 'visible' })
await sleep(1200)
await resetCanvas(page)
await installHud(page)
await sleep(400)

const timeline = []
const recStart = Date.now()

async function beat(spec, fn) {
  await hud(page, 'setCaption', spec.caption)
  const start = Date.now()
  await fn()
  const used = Date.now() - start
  const wait = spec.ms - used
  if (wait > 0) await sleep(wait)
  timeline.push({
    id: spec.id,
    startMs: start - recStart,
    usedMs: used,
    durationMs: Math.max(used, spec.ms),
  })
}

await beat(BEATS[0], async () => {
  await hud(page, 'setPrompt', '')
  await page.screenshot({ path: join(ARTIFACTS, 'demo_empty.png') })
  await page.screenshot({ path: join(GALLERY, '00-empty.png') })
})

await beat(BEATS[1], async () => {
  await typePrompt(
    page,
    "I'm planning my wedding for next June — about 80 guests. Set this page up for me.",
  )
  await agentCall(page, 'describe_current_state', {}, 'empty board')
})

let checklist
let guests
let vendors
let note

await beat(BEATS[2], async () => {
  checklist = await agentCall(page, 'add_widget', {
    type: 'checklist',
    title: 'Before the venue tour',
    rationale: 'Wedding prep checklist.',
  }, 'checklist')
  await agentCall(page, 'add_rows', {
    widgetId: checklist.widgetId,
    rows: [
      { text: 'Book photographer', done: false },
      { text: 'Taste cake', done: false },
    ],
  }, '2 items')
  await hold(1600)
  guests = await agentCall(page, 'add_widget', {
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
  }, 'table')
  await agentCall(page, 'add_rows', {
    widgetId: guests.widgetId,
    rows: [
      { name: 'Avery Chen', rsvp: 'pending' },
      { name: 'Jordan Lee', rsvp: 'yes' },
    ],
  }, '2 guests')
  await hold(1400)
  vendors = await agentCall(page, 'add_widget', {
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
  }, 'kanban')
  await agentCall(page, 'add_rows', {
    widgetId: vendors.widgetId,
    rows: [
      { title: 'Florist', status: 'contacted' },
      { title: 'DJ', status: 'to research' },
    ],
  }, '2 vendors')
  await hold(1400)
  note = await agentCall(page, 'add_widget', {
    type: 'note',
    title: 'Budget notes',
    config: { markdown: 'Cap florist at $2k. Venue deposit due March.' },
    rationale: 'Budget scratch pad.',
  }, 'note')
  await hold(1200)
  await agentCall(page, 'set_layout', {
    items: [
      { widgetId: checklist.widgetId, x: 0, y: 0, w: 4, h: 8 },
      { widgetId: guests.widgetId, x: 4, y: 0, w: 8, h: 8 },
      { widgetId: vendors.widgetId, x: 0, y: 8, w: 8, h: 10 },
      { widgetId: note.widgetId, x: 8, y: 8, w: 4, h: 10 },
    ],
    rationale: 'Checklist and guests on top, vendors wide below.',
  }, 'layout')
  await page.screenshot({ path: join(ARTIFACTS, 'demo_wedding.png') })
  await page.screenshot({ path: join(GALLERY, '01-wedding.png') })
})

await beat(BEATS[3], async () => {
  const florist = page.getByLabel('Florist card')
  const bookedDrop = page.getByText('Drop a card here, or add one below.')
  if (await florist.count() && await bookedDrop.count()) {
    await florist.dragTo(bookedDrop.first())
    await hud(page, 'logCall', 'human', 'dragged Florist to booked')
    await hold(1800)
  }
  const check = page.getByLabel('Mark Book photographer done')
  if (await check.count()) {
    await check.click()
    await hud(page, 'logCall', 'human', 'checked Book photographer')
    await hold(1400)
  }
  const pending = page.getByRole('button', { name: 'pending' }).first()
  if (await pending.count()) {
    await pending.click()
    const rsvp = page.getByLabel('RSVP')
    await rsvp.fill('yes')
    await rsvp.press('Enter')
    await hud(page, 'logCall', 'human', 'Avery RSVP yes')
    await hold(1400)
  }
  await page.getByRole('button', { name: 'Show activity' }).click()
  await hold(1200)
  await agentCall(page, 'get_activity_log', { limit: 8 }, 'what changed')
  await page.screenshot({ path: join(ARTIFACTS, 'demo_activity.png') })
  await page.screenshot({ path: join(GALLERY, '04-activity.png') })
  await page.getByRole('button', { name: 'Hide activity' }).click()
})

await beat(BEATS[4], async () => {
  await resetCanvas(page)
  await installHud(page)
  await typePrompt(page, 'Switch gears. I am tracking my job search.')
  const jobsKanban = await agentCall(page, 'add_widget', {
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
  }, 'kanban')
  await agentCall(page, 'add_rows', {
    widgetId: jobsKanban.widgetId,
    rows: [
      { title: 'Staff engineer, Ribbon', status: 'applied' },
      { title: 'Design lead, Northwind', status: 'screen' },
    ],
  }, 'roles')
  await hold(700)
  const contacts = await agentCall(page, 'add_widget', {
    type: 'table',
    title: 'Contacts',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'company', label: 'Company', type: 'text', required: true },
    ],
  }, 'table')
  await agentCall(page, 'add_rows', {
    widgetId: contacts.widgetId,
    rows: [{ name: 'Sam Patel', company: 'Ribbon' }],
  }, '1 contact')
  await hold(600)
  const weekly = await agentCall(page, 'add_widget', {
    type: 'checklist',
    title: 'Weekly goals',
  }, 'checklist')
  await agentCall(page, 'add_rows', {
    widgetId: weekly.widgetId,
    rows: [{ text: 'Apply to three roles', done: false }],
  }, '1 goal')
  await agentCall(page, 'set_theme', {
    boardTitle: 'Job search',
    theme: 'neutral',
    mode: 'dark',
    density: 'compact',
    rationale: 'Dark compact for a tracker.',
  }, 'dark compact')
  await page.screenshot({ path: join(ARTIFACTS, 'demo_jobs.png') })
  await page.screenshot({ path: join(GALLERY, '02-job-search.png') })
})

let form
await beat(BEATS[5], async () => {
  await resetCanvas(page)
  await installHud(page)
  await typePrompt(
    page,
    'I am managing type 2 diabetes. I want to log blood sugar readings and see trends.',
  )
  form = await agentCall(page, 'add_widget', {
    type: 'form',
    title: 'Blood sugar log',
    fields: FORM_FIELDS,
    rationale: 'Log readings.',
  }, 'form')
  await hold(1200)
  await agentCall(page, 'add_widget', {
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
      sourceWidgetId: form.widgetId,
    },
  }, 'chart')
})

await beat(BEATS[6], async () => {
  await agentCall(page, 'create_form_tool', {
    widgetId: form.widgetId,
    toolName: 'log_blood_sugar',
    description: MINT_DESCRIPTION,
    rationale: 'Mint the logging shortcut.',
  }, 'log_blood_sugar')
  await waitForTool(page, 'log_blood_sugar')
  await refreshToolCount(page)
  await hud(
    page,
    'setCaption',
    'The app just registered a NEW WebMCP tool: log_blood_sugar.',
  )
  await sleep(1800)
  await page.screenshot({ path: join(ARTIFACTS, 'demo_mint.png') })
  await page.screenshot({ path: join(GALLERY, '03-mint.png') })
})

await beat(BEATS[7], async () => {
  await agentCall(page, 'log_blood_sugar', {
    reading: 104,
    context: 'after meal',
  }, '104 after meal')
  await hold(2200)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByText('CHAMELEON', { exact: true }).waitFor({ state: 'visible' })
  await sleep(1200)
  await installHud(page)
  await hud(page, 'setPrompt', 'log a reading of 96, fasting')
  await waitForTool(page, 'log_blood_sugar')
  await refreshToolCount(page)
  await hud(page, 'logCall', 'log_blood_sugar', 'still listed after reload')
  await agentCall(page, 'log_blood_sugar', {
    reading: 96,
    context: 'fasting',
  }, '96 fasting')
  await page.screenshot({ path: join(ARTIFACTS, 'demo_health.png') })
  await page.screenshot({ path: join(GALLERY, '03b-health-logged.png') })
})

await beat(BEATS[8], async () => {
  await agentCall(page, 'undo', {}, 'remove last reading')
  await page.getByRole('button', { name: 'Show activity' }).click()
  await sleep(800)
  await page.screenshot({ path: join(ARTIFACTS, 'demo_undo.png') })
})

const trimSs = (recStart - videoOrigin) / 1000
await writeFile(
  join(OUT, 'timeline.json'),
  JSON.stringify({ trimSs, timeline, recStart, videoOrigin }, null, 2),
)

const video = page.video()
await context.close()
const videoPath = await video?.path()
console.log(JSON.stringify({ ok: true, videoPath, trimSs, timeline }, null, 2))
