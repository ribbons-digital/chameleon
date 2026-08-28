import { AppShell } from '@astryxdesign/core/AppShell'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { Theme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'
import { styles } from './app/styles'
import { BoardGrid } from './grid/BoardGrid'
import { useBoardStore } from './store/boardStore'

function App() {
  const title = useBoardStore((state) => state.document.title)
  const stateVersion = useBoardStore((state) => state.document.stateVersion)
  const commands = useBoardStore((state) => state.commands)
  const undo = useBoardStore((state) => state.undo)
  const reset = useBoardStore((state) => state.reset)
  const canUndo = commands.some(
    (command) => !command.undone && command.action !== 'undo',
  )
  const lastCommand = commands.at(-1)

  return (
    <Theme theme={neutralTheme}>
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
              <Heading level={1} type="display-3" xstyle={styles.brandMark}>
                {title}
              </Heading>
              <Text as="p" color="secondary">
                A workspace composed in conversation.
              </Text>
            </VStack>
            <HStack gap={2}>
              <Button
                label="Undo last change"
                variant="secondary"
                isDisabled={!canUndo}
                onClick={() => undo()}
              />
              <Button label="Reset canvas" variant="ghost" onClick={reset} />
            </HStack>
          </HStack>

          <VStack gap={0} xstyle={styles.gridWrap}>
            <BoardGrid />
          </VStack>

          <HStack
            hAlign="between"
            wrap="wrap"
            gap={2}
            xstyle={styles.activity}
          >
            <Text type="supporting">
              {lastCommand
                ? `Latest: ${lastCommand.summary}`
                : 'Drag or resize a widget to create the first activity entry.'}
            </Text>
            <Text type="code" color="secondary">
              state v{stateVersion} · {commands.length} commands
            </Text>
          </HStack>
        </VStack>
      </AppShell>
    </Theme>
  )
}

export default App
