import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import { Theme, type DefinedTheme } from '@astryxdesign/core/theme'
import { useState } from 'react'
import { butterTheme } from '@astryxdesign/theme-butter/built'
import { chocolateTheme } from '@astryxdesign/theme-chocolate/built'
import { gothicTheme } from '@astryxdesign/theme-gothic/built'
import { matchaTheme } from '@astryxdesign/theme-matcha/built'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'
import { stoneTheme } from '@astryxdesign/theme-stone/built'
import { y2kTheme } from '@astryxdesign/theme-y2k/built'
import type { ThemeName } from './model/types'
import { styles } from './app/styles'
import { ActivityDrawer } from './components/ActivityDrawer'
import { AddWidgetMenu } from './components/AddWidgetMenu'
import { AgentPulse } from './components/AgentPulse'
import { BoardTitle } from './components/BoardTitle'
import { BoardGrid } from './grid/BoardGrid'
import { useBoardStore } from './store/boardStore'
import { usePersistHealth } from './store/persistStorage'
import {
  getModelContextSource,
  WEBMCP_ENABLE_HINT,
} from './webmcp/modelContext'
import { STATIC_TOOL_NAMES } from './webmcp/tools'

const THEMES: Record<ThemeName, DefinedTheme> = {
  neutral: neutralTheme,
  butter: butterTheme,
  chocolate: chocolateTheme,
  matcha: matchaTheme,
  stone: stoneTheme,
  gothic: gothicTheme,
  y2k: y2kTheme,
}

function App() {
  const [resetOpen, setResetOpen] = useState(false)
  const boardTheme = useBoardStore(
    (state) => state.document.theme,
  )
  const stateVersion = useBoardStore((state) => state.document.stateVersion)
  const commands = useBoardStore((state) => state.commands)
  const undo = useBoardStore((state) => state.undo)
  const reset = useBoardStore((state) => state.reset)
  const canUndo = commands.some(
    (command) => !command.undone && command.action !== 'undo',
  )
  const mintedCount = useBoardStore(
    (state) => state.document.mintedTools.length,
  )
  const webmcpSource = getModelContextSource()
  const persistHealth = usePersistHealth()
  const hosted = Boolean(webmcpSource)
  const toolCount = STATIC_TOOL_NAMES.length + mintedCount

  return (
    <Theme theme={THEMES[boardTheme.name]} mode={boardTheme.mode}>
      <AppShell
        height="auto"
        variant="wash"
        contentPadding={0}
        xstyle={styles.shell}
      >
        <VStack gap={0} xstyle={styles.page}>
          <HStack
            hAlign="between"
            vAlign="center"
            wrap="wrap"
            gap={4}
            xstyle={styles.header}
          >
            <VStack gap={1}>
              <Text type="label" color="accent" weight="semibold">
                CHAMELEON
              </Text>
              <BoardTitle />
              <Text as="p" color="secondary">
                A workspace composed in conversation.
              </Text>
            </VStack>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Token
                size="sm"
                color={hosted ? 'green' : 'gray'}
                label={
                  hosted
                    ? `${toolCount} tools via ${webmcpSource}`
                    : `${toolCount} tools ready`
                }
              />
              <AddWidgetMenu />
              <Button
                label="Undo last change"
                variant="secondary"
                isDisabled={!canUndo}
                onClick={() => undo()}
              />
              <Button
                label="Reset canvas"
                variant="ghost"
                onClick={() => setResetOpen(true)}
              />
            </HStack>
          </HStack>

          {!hosted && (
            <Banner
              status="info"
              container="card"
              title="WebMCP not detected in this browser"
              description={WEBMCP_ENABLE_HINT}
              isDismissable
              xstyle={styles.banner}
            />
          )}

          {persistHealth === 'quota' && (
            <Banner
              status="warning"
              container="card"
              title="This browser is out of storage for the board"
              description="New edits will not persist across reload until you free space or reset the canvas."
              xstyle={styles.banner}
            />
          )}

          <VStack gap={0} xstyle={styles.gridWrap}>
            <BoardGrid />
          </VStack>

          <HStack
            hAlign="between"
            wrap="wrap"
            gap={2}
            xstyle={styles.activity}
          >
            <ActivityDrawer />
            <Text type="code" color="secondary">
              state v{stateVersion} · {commands.length} commands
            </Text>
          </HStack>
        </VStack>
      </AppShell>
      <AgentPulse />
      <AlertDialog
        isOpen={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset this canvas?"
        description="Returns to an untitled empty board and removes every widget, row, minted tool, and activity entry. This cannot be undone."
        actionLabel="Reset workspace"
        onAction={() => {
          reset()
          setResetOpen(false)
        }}
      />
    </Theme>
  )
}

export default App
