#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  rmSync,
  openSync,
  closeSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const SKILL_DIR = resolve(SCRIPT_DIR, '..')
const DEFAULT_PORT = 14711
const READY_TIMEOUT_MS = 60_000
const ACTION_TIMEOUT_MS = 15_000
const EMPTY_ACTIVITY =
  'Drag, edit, or ask an agent to create the first activity entry.'
const SEED_COMMANDS_RE = /^state v\d+ · 0 commands$/

function fail(message, extra) {
  process.stderr.write(`error: ${message}\n`)
  if (extra) process.stderr.write(`${extra}\n`)
  process.exit(1)
}

function usage() {
  process.stdout.write(`Usage: control-chameleon <command>

Commands:
  launch                 Start an isolated Vite instance and a fresh Chrome profile
  doctor [--expect-empty|--expect-sample] Check that this run's instance is healthy
  status                 Print the run state JSON
  cleanup                Stop processes this run started (keeps artifacts)
  browser click --role <role> --name <name>
  browser click --text <text>
  browser assert --text <text>
  browser assert --role <role> --name <name> [--disabled|--enabled]
  browser refute --text <text>
  browser fill --role <role> --name <name> --value <text> [--blur|--press <key>]
  browser note --name <heading> --markdown <text>
  browser cell --from <button-label> --value <text> [--field <textbox-name>]
  browser menu --name <button> --item <menuitem-name-prefix>
  browser rename --value <board-name>
  browser rename-widget --name <heading> --value <widget-name>
  browser reset
  browser drag --name <heading> --dx <px> --dy <px>
  browser resize --name <heading> --dx <px> --dy <px>
  browser measure --name <heading>
  browser reload
  browser wait --text <text>
  browser snapshot --aria --path <file>
  browser screenshot --path <file>
  browser storage --path <file>

Follow-up flags (same Chrome session as the action):
  --wait-text <text>
  --settle <ms>            Pause after the action so transitions finish
  --aria-snapshot <file>
  --screenshot <file>
  --width <px>             Viewport width (default 1400)
  --height <px>            Viewport height (default 900)

Env:
  CHAMELEON_VERIFY_RUN     Run id (default: default)
  CHAMELEON_VERIFY_PORT    Vite port (default: ${DEFAULT_PORT})
  CHAMELEON_VERIFY_DIR     Scratch dir (default: /tmp/chameleon-verify/<run>)
  CHAMELEON_VERIFY_REPO    Chameleon repo root
  CHAMELEON_VERIFY_HEADED  1 to show Chrome
  CHROME_PATH              Chrome binary
`)
}

function parseArgs(argv) {
  const flags = {}
  const rest = []
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--') {
      rest.push(...argv.slice(i + 1))
      break
    }
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true
      } else {
        flags[key] = next
        i += 1
      }
    } else {
      rest.push(token)
    }
  }
  return { flags, rest }
}

function findRepoRoot() {
  if (process.env.CHAMELEON_VERIFY_REPO) return resolve(process.env.CHAMELEON_VERIFY_REPO)
  let dir = process.cwd()
  while (true) {
    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      if (pkg.name === 'chameleon') return dir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  fail('Run from the chameleon repo (package.json name "chameleon"), or set CHAMELEON_VERIFY_REPO.')
}

function runConfig() {
  const runId = process.env.CHAMELEON_VERIFY_RUN || 'default'
  const dir = resolve(process.env.CHAMELEON_VERIFY_DIR || join('/tmp/chameleon-verify', runId))
  const port = Number(process.env.CHAMELEON_VERIFY_PORT || DEFAULT_PORT)
  if (!Number.isInteger(port) || port < 1) {
    fail(`Invalid CHAMELEON_VERIFY_PORT: ${process.env.CHAMELEON_VERIFY_PORT}`)
  }
  return {
    runId,
    dir,
    statePath: join(dir, 'state.json'),
    viteLog: join(dir, 'vite.log'),
    userDataDir: join(dir, 'chrome-profile'),
    port,
    url: `http://127.0.0.1:${port}/`,
    headed: process.env.CHAMELEON_VERIFY_HEADED === '1',
  }
}

function alive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readState(cfg, { required = true } = {}) {
  if (!existsSync(cfg.statePath)) {
    if (required) fail(`No run state at ${cfg.statePath}. Run launch first.`)
    return null
  }
  return JSON.parse(readFileSync(cfg.statePath, 'utf8'))
}

function writeState(cfg, state) {
  mkdirSync(cfg.dir, { recursive: true })
  writeFileSync(cfg.statePath, `${JSON.stringify(state, null, 2)}\n`)
}

function resolveArtifactPath(pathValue) {
  if (!pathValue || pathValue === true) fail('Missing --path')
  return isAbsolute(pathValue) ? pathValue : resolve(SKILL_DIR, pathValue)
}

function chromeBin() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean)
  const found = candidates.find((bin) => existsSync(bin))
  if (!found) fail('Chrome not found. Set CHROME_PATH to a Chrome/Chromium binary.')
  return found
}

function ensureHarnessInstalled() {
  const marker = join(SCRIPT_DIR, 'node_modules', 'playwright-core')
  if (existsSync(marker)) return
  execSync('npm install', { cwd: SCRIPT_DIR, stdio: 'inherit' })
}

function loadPlaywright() {
  ensureHarnessInstalled()
  const require = createRequire(join(SCRIPT_DIR, 'package.json'))
  return require('playwright-core').chromium
}

async function waitForHttp(url, timeoutMs) {
  const start = Date.now()
  let last = ''
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' })
      if (res.ok) return
      last = `HTTP ${res.status}`
    } catch (err) {
      last = err instanceof Error ? err.message : String(err)
    }
    await sleep(200)
  }
  fail(`Timed out waiting for ${url}`, last)
}

function spawnLogged(command, args, { cwd, logPath }) {
  mkdirSync(dirname(logPath), { recursive: true })
  appendFileSync(logPath, `\n$ ${command} ${args.join(' ')}\n`)
  const fd = openSync(logPath, 'a')
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ['ignore', fd, fd],
    env: process.env,
  })
  child.unref()
  closeSync(fd)
  return child
}

function killPid(pid) {
  if (!alive(pid)) return
  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      return
    }
  }
}

async function waitDead(pid, timeoutMs) {
  const start = Date.now()
  while (alive(pid) && Date.now() - start < timeoutMs) await sleep(100)
  if (!alive(pid)) return
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
  }
}

function viewportFromFlags(flags) {
  const width = flags.width === undefined ? 1400 : Number(flags.width)
  const height = flags.height === undefined ? 900 : Number(flags.height)
  if (!Number.isFinite(width) || width < 1 || !Number.isFinite(height) || height < 1) {
    fail('Need numeric --width and --height')
  }
  return { width, height }
}

async function withPage(state, fn, flags = {}) {
  const chromium = loadPlaywright()
  const viewport = viewportFromFlags(flags)
  const context = await chromium.launchPersistentContext(state.userDataDir, {
    executablePath: chromeBin(),
    headless: process.env.CHAMELEON_VERIFY_HEADED !== '1',
    viewport,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  })
  try {
    const page = context.pages()[0] ?? (await context.newPage())
    page.setDefaultTimeout(ACTION_TIMEOUT_MS)
    await context
      .grantPermissions(['clipboard-read', 'clipboard-write'])
      .catch(() => {})
    await page.goto(state.url, { waitUntil: 'domcontentloaded' })
    await page.getByText('CHAMELEON', { exact: true }).waitFor({ state: 'visible' })
    return await fn(page)
  } finally {
    await context.close()
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function roleLocator(page, flags) {
  if (!flags.role) fail('Missing --role')
  if (!flags.name) fail('Missing --name')
  return page.getByRole(flags.role, { name: flags.name, exact: true })
}

function widgetHandle(page, name) {
  return page
    .getByRole('heading', { name, exact: true })
    .locator('xpath=ancestor::*[contains(@class,"widget-drag-handle")][1]')
}

function widgetCard(page, name) {
  return page
    .getByRole('heading', { name, exact: true })
    .locator('xpath=ancestor::article[1]')
}

function gridItem(page, name) {
  return page
    .getByRole('heading', { name, exact: true })
    .locator('xpath=ancestor::*[contains(@class,"react-grid-item")][1]')
}

async function maybeFollowup(page, flags) {
  const extra = {}
  if (flags['wait-text'] && flags['wait-text'] !== true) {
    await page.getByText(flags['wait-text']).first().waitFor({ state: 'visible' })
    extra.waited = flags['wait-text']
  }
  const settle = Number(flags.settle)
  if (Number.isFinite(settle) && settle > 0) {
    // Let open/close transitions finish before a snapshot or screenshot.
    await page.waitForTimeout(settle)
    extra.settled = settle
  }
  if (flags['aria-snapshot'] && flags['aria-snapshot'] !== true) {
    const path = resolveArtifactPath(flags['aria-snapshot'])
    mkdirSync(dirname(path), { recursive: true })
    const snapshot = await page.locator('body').ariaSnapshot()
    writeFileSync(path, `${snapshot}\n`)
    extra.snapshot = path
  }
  if (typeof flags.screenshot === 'string') {
    const path = resolveArtifactPath(flags.screenshot)
    mkdirSync(dirname(path), { recursive: true })
    await page.screenshot({ path, fullPage: true })
    extra.screenshot = path
  }
  return extra
}

async function launch() {
  const repo = findRepoRoot()
  const cfg = runConfig()
  if (cfg.port === 4711) {
    fail(
      'Refusing port 4711. That is the human `npm run dev` port. Use CHAMELEON_VERIFY_PORT (default 14711) so this run cannot steal a shared session.',
    )
  }
  const existing = readState(cfg, { required: false })
  if (existing && alive(existing.vitePid)) {
    fail(
      `Run "${cfg.runId}" is already live at ${existing.url}. Drive that instance, or run cleanup first.`,
      JSON.stringify(existing, null, 2),
    )
  }
  if (!existsSync(join(repo, 'node_modules', 'vite'))) {
    execSync('npm install', { cwd: repo, stdio: 'inherit' })
  }
  ensureHarnessInstalled()
  mkdirSync(cfg.dir, { recursive: true })
  rmSync(cfg.userDataDir, { recursive: true, force: true })
  mkdirSync(cfg.userDataDir, { recursive: true })

  const vite = spawnLogged(
    process.execPath,
    [
      join(repo, 'node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(cfg.port),
      '--strictPort',
    ],
    { cwd: repo, logPath: cfg.viteLog },
  )
  try {
    await waitForHttp(cfg.url, READY_TIMEOUT_MS)
  } catch (err) {
    killPid(vite.pid)
    throw err
  }

  const state = {
    runId: cfg.runId,
    url: cfg.url,
    port: cfg.port,
    vitePid: vite.pid,
    userDataDir: cfg.userDataDir,
    dir: cfg.dir,
    repo,
    startedAt: new Date().toISOString(),
  }
  writeState(cfg, state)
  process.stdout.write(
    `${JSON.stringify({ ok: true, command: 'launch', url: state.url, runId: state.runId, vitePid: state.vitePid, userDataDir: state.userDataDir }, null, 2)}\n`,
  )
}

async function doctor(flags) {
  const cfg = runConfig()
  const state = readState(cfg)
  if (state.url !== cfg.url) {
    fail(
      `State URL ${state.url} does not match this run's URL ${cfg.url}. Do not drive a different instance.`,
    )
  }
  if (!alive(state.vitePid)) fail(`Vite pid ${state.vitePid} is not running. Launch again.`)
  const res = await fetch(state.url)
  if (!res.ok) fail(`GET ${state.url} returned HTTP ${res.status}`)
  const pageInfo = await withPage(state, async (page) => {
    const chameleon = await page.getByText('CHAMELEON', { exact: true }).isVisible()
    const canvas = await page.getByRole('region', { name: 'Widget canvas' }).isVisible()
    const undo = page.getByRole('button', { name: 'Undo last change', exact: true })
    const reset = page.getByRole('button', { name: 'Reset canvas', exact: true })
    const addWidget = page.getByRole('button', { name: 'Add widget', exact: true })
    const renameBoard = page.getByRole('button', { name: 'Rename board', exact: true })
    const showActivity = page.getByRole('button', { name: 'Show activity', exact: true })
    const info = {
      chameleon,
      canvas,
      undoVisible: await undo.isVisible(),
      undoDisabled: await undo.isDisabled(),
      resetVisible: await reset.isVisible(),
      addWidgetVisible: await addWidget.isVisible(),
      renameBoardVisible: await renameBoard.isVisible(),
      showActivityVisible: await showActivity.isVisible(),
      title: (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '',
      activity:
        (
          await page
            .getByText(/Latest:|Drag, edit, or ask an agent/)
            .first()
            .textContent()
        )?.trim() ?? '',
      versionLine: (await page.getByText(/state v\d+/).first().textContent())?.trim() ?? '',
      toolsToken:
        (await page.getByText(/tools (ready|via)/).first().textContent())?.trim() ?? '',
      webmcpBanner: await page
        .getByText('WebMCP not detected in this browser')
        .isVisible()
        .catch(() => false),
    }
    if (flags['expect-empty'] || flags['expect-seed']) {
      info.empty = await page
        .getByRole('heading', { name: 'What are you working on?', exact: true })
        .isVisible()
      info.copyWedding = await page
        .getByRole('button', { name: 'Copy wedding planner prompt', exact: true })
        .isVisible()
      info.loadSample = await page
        .getByRole('button', { name: 'Load a sample board', exact: true })
        .isVisible()
      if (info.title !== 'Untitled workspace') {
        fail(`Expected title Untitled workspace, got ${JSON.stringify(info.title)}`)
      }
      if (!info.empty || !info.copyWedding || !info.loadSample) {
        fail('Empty canvas is missing. Reset the canvas or launch a fresh run.')
      }
      if (info.activity !== EMPTY_ACTIVITY) {
        fail(`Expected empty activity copy, got ${JSON.stringify(info.activity)}`)
      }
      if (!SEED_COMMANDS_RE.test(info.versionLine)) {
        fail(`Expected version line with 0 commands, got ${JSON.stringify(info.versionLine)}`)
      }
      if (!info.undoDisabled) fail('Undo last change should be disabled on an empty canvas.')
    }
    if (flags['expect-sample']) {
      info.welcome = await page
        .getByRole('heading', { name: 'A canvas that listens', exact: true })
        .isVisible()
      info.next = await page
        .getByRole('heading', { name: 'What happens next', exact: true })
        .isVisible()
      if (!info.welcome || !info.next) {
        fail('Sample widgets are missing. Choose Load a sample board from the empty canvas.')
      }
    }
    return info
  })
  if (
    !pageInfo.chameleon ||
    !pageInfo.canvas ||
    !pageInfo.undoVisible ||
    !pageInfo.resetVisible ||
    !pageInfo.addWidgetVisible ||
    !pageInfo.renameBoardVisible
  ) {
    fail('Page is missing Chameleon identity controls.', JSON.stringify(pageInfo, null, 2))
  }
  process.stdout.write(
    `${JSON.stringify({ ok: true, command: 'doctor', url: state.url, runId: state.runId, userDataDir: state.userDataDir, ...pageInfo }, null, 2)}\n`,
  )
}

function noteEditor(page) {
  const named = page.getByRole('textbox', { name: 'Note markdown' })
  const textarea = page.locator('textarea')
  return named.or(textarea).first()
}

async function editNote(page, flags) {
  if (!flags.name || flags.name === true) fail('Missing --name')
  if (!flags.markdown || flags.markdown === true) fail('Missing --markdown')
  const card = widgetCard(page, flags.name)
  await card.waitFor({ state: 'visible' })
  const editor = noteEditor(page)
  if (!(await editor.isVisible().catch(() => false))) {
    const markdown = card.getByRole('document').or(card.locator('p')).first()
    await markdown.click()
  }
  await editor.waitFor({ state: 'visible' })
  await editor.fill(String(flags.markdown))
  await editor.blur()
  return { edited: flags.name }
}

async function editCell(page, flags) {
  if (!flags.from || flags.from === true) fail('Missing --from')
  if (flags.value === undefined || flags.value === true) fail('Missing --value')
  const field = flags.field && flags.field !== true ? flags.field : 'Step'
  await page.getByRole('button', { name: flags.from, exact: true }).click()
  const box = page.getByRole('textbox', { name: field, exact: true })
  await box.waitFor({ state: 'visible' })
  await box.fill(String(flags.value))
  await box.press('Enter')
  return { from: flags.from, field, valueLength: String(flags.value).length }
}

async function browserCommand(subcommand, flags) {
  const cfg = runConfig()
  const state = readState(cfg)
  const result = await withPage(
    state,
    async (page) => {
    switch (subcommand) {
      case 'click': {
        if (flags.text) {
          await page.getByText(flags.text).first().click()
          return { clicked: flags.text, ...(await maybeFollowup(page, flags)) }
        }
        const locator = roleLocator(page, flags)
        await locator.click()
        return { clicked: `${flags.role}:${flags.name}`, ...(await maybeFollowup(page, flags)) }
      }
      case 'assert': {
        if (flags.text) {
          const visible = await page.getByText(flags.text).first().isVisible()
          if (!visible) fail(`Not visible: ${JSON.stringify(flags.text)}`)
          return { assert: 'text', text: flags.text, ...(await maybeFollowup(page, flags)) }
        }
        const locator = roleLocator(page, flags)
        const visible = await locator.isVisible()
        if (!visible) fail(`Not visible: ${flags.role} ${JSON.stringify(flags.name)}`)
        if (flags.disabled) {
          if (!(await locator.isDisabled())) fail(`Expected disabled: ${flags.name}`)
        }
        if (flags.enabled) {
          if (await locator.isDisabled()) fail(`Expected enabled: ${flags.name}`)
        }
        return { assert: 'role', role: flags.role, name: flags.name, ...(await maybeFollowup(page, flags)) }
      }
      case 'refute': {
        if (!flags.text) fail('Missing --text')
        const count = await page.getByText(flags.text).count()
        if (count > 0 && (await page.getByText(flags.text).first().isVisible())) {
          fail(`Unexpectedly visible: ${JSON.stringify(flags.text)}`)
        }
        return { refute: flags.text, ...(await maybeFollowup(page, flags)) }
      }
      case 'fill': {
        if (flags.value === undefined || flags.value === true) fail('Missing --value')
        const locator = roleLocator(page, flags)
        await locator.fill(String(flags.value))
        if (flags.blur) await locator.blur()
        if (flags.press && flags.press !== true) await locator.press(String(flags.press))
        return { filled: flags.name, ...(await maybeFollowup(page, flags)) }
      }
      case 'note': {
        const edited = await editNote(page, flags)
        return { ...edited, ...(await maybeFollowup(page, flags)) }
      }
      case 'cell': {
        const edited = await editCell(page, flags)
        return { ...edited, ...(await maybeFollowup(page, flags)) }
      }
      case 'menu': {
        // Open a dropdown menu and pick an item in one Chrome session; the menu
        // is React state and would be gone by the next command.
        if (!flags.name) fail('Missing --name')
        if (!flags.item || flags.item === true) fail('Missing --item')
        await page.getByRole('button', { name: flags.name, exact: true }).click()
        const item = page.getByRole('menuitem', {
          name: new RegExp(`^${escapeRegExp(String(flags.item))}\\b`),
        })
        await item.waitFor({ state: 'visible' })
        await item.click()
        return { menu: flags.name, item: flags.item, ...(await maybeFollowup(page, flags)) }
      }
      case 'rename': {
        if (flags.value === undefined || flags.value === true) fail('Missing --value')
        await page.getByRole('button', { name: 'Rename board', exact: true }).click()
        const box = page.getByRole('textbox', { name: 'Board name', exact: true })
        await box.waitFor({ state: 'visible' })
        await box.fill(String(flags.value))
        await box.press('Enter')
        return { renamed: flags.value, ...(await maybeFollowup(page, flags)) }
      }
      case 'rename-widget': {
        if (!flags.name || flags.name === true) fail('Missing --name')
        if (flags.value === undefined || flags.value === true) fail('Missing --value')
        await page
          .getByRole('button', {
            name: `Rename ${flags.name}`,
            exact: true,
          })
          .click()
        const box = page.getByRole('textbox', {
          name: 'Widget name',
          exact: true,
        })
        await box.waitFor({ state: 'visible' })
        await box.fill(String(flags.value))
        await box.press('Enter')
        return {
          renamedWidget: flags.name,
          value: flags.value,
          ...(await maybeFollowup(page, flags)),
        }
      }
      case 'reset': {
        await page
          .getByRole('button', { name: 'Reset canvas', exact: true })
          .click()
        const dialog = page.getByRole('alertdialog', {
          name: 'Reset this canvas?',
          exact: true,
        })
        await dialog.waitFor({ state: 'visible' })
        await dialog
          .getByRole('button', { name: 'Reset workspace', exact: true })
          .click()
        return { reset: true, ...(await maybeFollowup(page, flags)) }
      }
      case 'wait': {
        if (!flags.text) fail('Missing --text')
        await page.getByText(flags.text).first().waitFor({ state: 'visible' })
        return { waited: flags.text, ...(await maybeFollowup(page, flags)) }
      }
      case 'drag': {
        if (!flags.name) fail('Missing --name')
        const dx = Number(flags.dx)
        const dy = Number(flags.dy ?? 0)
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) fail('Need numeric --dx and --dy')
        const handle = widgetHandle(page, flags.name)
        await handle.waitFor({ state: 'visible' })
        const box = await handle.boundingBox()
        if (!box) fail(`No bounding box for widget ${flags.name}`)
        const startX = box.x + Math.min(40, box.width / 2)
        const startY = box.y + Math.min(20, box.height / 4)
        await page.mouse.move(startX, startY)
        await page.mouse.down()
        await page.mouse.move(startX + dx, startY + dy, { steps: 30 })
        await page.mouse.up()
        return { dragged: flags.name, dx, dy, ...(await maybeFollowup(page, flags)) }
      }
      case 'resize': {
        if (!flags.name) fail('Missing --name')
        const dx = Number(flags.dx)
        const dy = Number(flags.dy ?? 0)
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) fail('Need numeric --dx and --dy')
        const item = gridItem(page, flags.name)
        const handle = item.locator('.react-resizable-handle').last()
        await handle.waitFor({ state: 'visible' })
        const before = await item.boundingBox()
        if (!before) fail(`No bounding box for widget ${flags.name}`)
        const box = await handle.boundingBox()
        if (!box) fail(`No resize handle for ${flags.name}`)
        // react-resizable draws the active southeast grip in the handle's
        // lower-right corner. Its centre can be covered by card content even
        // though Playwright sees the whole span, producing a false-positive
        // "resized" command with no mutation.
        const startX = box.x + box.width - 2
        const startY = box.y + box.height - 2
        await page.mouse.move(startX, startY)
        await page.mouse.down()
        await page.mouse.move(startX + dx, startY + dy, { steps: 30 })
        await page.mouse.up()
        await page.waitForTimeout(100)
        const after = await item.boundingBox()
        const changed = Boolean(
          after && (after.width !== before.width || after.height !== before.height),
        )
        return {
          resized: flags.name,
          dx,
          dy,
          changed,
          before: { width: before.width, height: before.height },
          after: after ? { width: after.width, height: after.height } : null,
          ...(await maybeFollowup(page, flags)),
        }
      }
      case 'measure': {
        if (!flags.name) fail('Missing --name')
        const card = widgetCard(page, flags.name)
        await card.waitFor({ state: 'visible' })
        const box = await card.boundingBox()
        if (!box) fail(`No bounding box for ${flags.name}`)
        return { measured: flags.name, box, ...(await maybeFollowup(page, flags)) }
      }
      case 'reload': {
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.getByText('CHAMELEON', { exact: true }).waitFor({ state: 'visible' })
        return { reloaded: state.url, ...(await maybeFollowup(page, flags)) }
      }
      case 'snapshot': {
        if (!flags.aria) fail('Pass --aria')
        const path = resolveArtifactPath(flags.path)
        mkdirSync(dirname(path), { recursive: true })
        const snapshot = await page.locator('body').ariaSnapshot()
        writeFileSync(path, `${snapshot}\n`)
        return { snapshot: path, ...(await maybeFollowup(page, flags)) }
      }
      case 'screenshot': {
        const path = resolveArtifactPath(flags.path)
        mkdirSync(dirname(path), { recursive: true })
        await page.screenshot({ path, fullPage: true })
        return { screenshot: path }
      }
      case 'storage': {
        const path = resolveArtifactPath(flags.path)
        mkdirSync(dirname(path), { recursive: true })
        const raw = await page.evaluate(() => localStorage.getItem('chameleon-board-v1'))
        writeFileSync(path, raw ?? 'null')
        if (!raw) fail('localStorage chameleon-board-v1 is empty')
        return { storage: path }
      }
      default:
        fail(`Unknown browser subcommand: ${subcommand}`)
    }
    },
    flags,
  )
  process.stdout.write(
    `${JSON.stringify({ ok: true, command: `browser ${subcommand}`, ...result }, null, 2)}\n`,
  )
}

async function cleanup() {
  const cfg = runConfig()
  const state = readState(cfg, { required: false })
  if (state) {
    killPid(state.vitePid)
    await waitDead(state.vitePid, 5_000)
  }
  rmSync(cfg.userDataDir, { recursive: true, force: true })
  if (existsSync(cfg.statePath)) rmSync(cfg.statePath)
  process.stdout.write(
    `${JSON.stringify({ ok: true, command: 'cleanup', runId: cfg.runId, keptArtifacts: join(SKILL_DIR, 'artifacts') }, null, 2)}\n`,
  )
}

function status() {
  const cfg = runConfig()
  const state = readState(cfg, { required: false })
  process.stdout.write(
    `${JSON.stringify({ ok: true, command: 'status', runId: cfg.runId, live: Boolean(state && alive(state.vitePid)), state }, null, 2)}\n`,
  )
}

const { flags, rest } = parseArgs(process.argv.slice(2))
const command = rest[0]
if (!command || command === 'help' || flags.help) {
  usage()
  process.exit(command ? 0 : 1)
}

try {
  if (command === 'launch') await launch()
  else if (command === 'doctor') await doctor(flags)
  else if (command === 'cleanup') await cleanup()
  else if (command === 'status') status()
  else if (command === 'browser') await browserCommand(rest[1], flags)
  else fail(`Unknown command: ${command}`)
} catch (err) {
  fail(err instanceof Error ? err.message : String(err), err instanceof Error ? err.stack : undefined)
}
