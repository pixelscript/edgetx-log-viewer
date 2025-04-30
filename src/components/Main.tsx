import "@mantine/core/styles.css";
import { AppShell, Burger, Group, Text, Stack, Title, Button, Tabs } from "@mantine/core"; // Import Tabs
import { useDisclosure } from '@mantine/hooks';
import { useSelector } from "react-redux";
import { RootState } from "../state/store";
import LogFileUploader from "./LogFileUploader";
import LogSelectorTable from "./LogSelectorTable";
import EarthViewer from "./EarthViewer";
import ModeColorKey from "./ModeColorKey";
import PlaybackControls from "./PlaybackControls"; // Import PlaybackControls
import FlightStatsDisplay from "./FlightStatsDisplay";
import { IconDownload } from '@tabler/icons-react';
import '@mantine/dropzone/styles.css';
import ExportModal from './ExportModal';
import { ThemeToggle } from './ThemeToggle';

export default function Main() {
  const [navbarOpened, { toggle: toggleNavbar }] = useDisclosure(true);
  const [exportModalOpened, { open: openExportModal, close: closeExportModal }] = useDisclosure(false);
  const selectedLogFilename = useSelector((state: RootState) => state.logs.selectedLogFilename);

  return (
    <>
      <AppShell
        padding="md"
        header={{ height: 60 }}
        navbar={{ width: 570, breakpoint: 'sm', collapsed: { mobile: !navbarOpened, desktop: !navbarOpened } }}
      >
        <AppShell.Header>
          <Group h="100%" px="md">
            <Burger opened={navbarOpened} onClick={toggleNavbar} hiddenFrom="sm" size="sm" />
            <img src="./logo.png" alt="A blue squiggle with and orange triangle at the end" style={{ height: 40 }} />
            <Title order={3}>EdgeTX Log Viewer [BETA]</Title>
            {selectedLogFilename && (
              <Text size="sm" c="dimmed" ml="md"> - {selectedLogFilename}</Text>
            )}
            <Group justify="flex-end" style={{ flex: 1 }}>
              <ThemeToggle />
              {selectedLogFilename && (
                <Button
                  variant="light"
                  leftSection={<IconDownload size={14} />}
                  onClick={openExportModal}
                  ml="xs"
                >
                  Export Log
                </Button>
              )}
            </Group>

          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="md">
           <LogSelectorTable />
           <LogFileUploader />
        </AppShell.Navbar>

        <AppShell.Main>
        <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            {/* Use Tabs component here */}
            <Tabs defaultValue="stats" style={{ flexShrink: 0 }}> {/* Add flexShrink to prevent tabs from shrinking */}
              <Tabs.List>
                <Tabs.Tab value="stats">Stats</Tabs.Tab>
                <Tabs.Tab value="playback">Playback</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="stats" pt="xs"> {/* Add padding top */}
                <FlightStatsDisplay />
              </Tabs.Panel>

              <Tabs.Panel value="playback" pt="xs"> {/* Add padding top */}
                <PlaybackControls /> {/* Use PlaybackControls component */}
              </Tabs.Panel>
            </Tabs>

            {/* Keep ModeColorKey and EarthViewer below the tabs */}
            <Stack style={{ flex: 1, marginTop: 'md' }}> {/* Add marginTop and keep flex: 1 */}
              <ModeColorKey />
              <EarthViewer />
            </Stack>
          </div>
        </AppShell.Main>
      </AppShell>
      <ExportModal opened={exportModalOpened} close={closeExportModal} />
    </>
  );
}
