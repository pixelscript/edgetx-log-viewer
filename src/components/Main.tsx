import "@mantine/core/styles.css";
import { AppShell, Burger, Group, Text, Stack, Title, Button } from "@mantine/core";
import { useDisclosure } from '@mantine/hooks';
import { useSelector } from "react-redux";
import { RootState } from "../state/store";
import LogFileUploader from "./LogFileUploader";
import LogSelectorTable from "./LogSelectorTable";
import EarthViewer from "./EarthViewer";
import ModeColorKey from "./ModeColorKey";
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
          <Stack style={{ flex: 1 }}>
            <FlightStatsDisplay />
            <ModeColorKey />
            <EarthViewer/>
          </Stack>
          </div>
        </AppShell.Main>
      </AppShell>
      <ExportModal opened={exportModalOpened} close={closeExportModal} />
    </>
  );
}
