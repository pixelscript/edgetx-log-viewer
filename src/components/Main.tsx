import "@mantine/core/styles.css";
import { AppShell, Burger, Group, Text, Stack, Title, Button, Tabs, Select, Paper } from "@mantine/core";
import { useDisclosure } from '@mantine/hooks';
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../state/store";
import { setViewMode, ViewMode, selectMapType, setMapType } from "../state/uiSlice";
import { MapType } from "../consts/earth";
import LogFileUploader from "./LogFileUploader";
import LogSelectorTable from "./LogSelectorTable";
import EarthViewer from "./EarthViewer";
import ModeColorKey from "./ModeColorKey";
import PlaybackControls from "./PlaybackControls";
import FlightStatsDisplay from "./FlightStatsDisplay";
import { IconDownload } from '@tabler/icons-react';
import '@mantine/dropzone/styles.css';
import ExportModal from './ExportModal';
import { ThemeToggle } from './ThemeToggle';

export default function Main() {
  const [navbarOpened, { toggle: toggleNavbar }] = useDisclosure(true);
  const [exportModalOpened, { open: openExportModal, close: closeExportModal }] = useDisclosure(false);
  const selectedLogFilename = useSelector((state: RootState) => state.logs.selectedLogFilename);
  const dispatch = useDispatch();
  const currentMapType = useSelector(selectMapType);

  const mapTypeOptions = Object.values(MapType).map(type => ({ value: type, label: type }));

  const handleTabChange = (value: string | null) => {
    if (value) {
      dispatch(setViewMode(value as ViewMode));
    }
  };

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
          <Paper withBorder shadow="sm" p="sm" mt="md">
            <Group justify="space-between" mb="sm">
              <Title order={4}>Map Type</Title>
            </Group>
            <Select
              data={mapTypeOptions}
              value={currentMapType}
              onChange={(value) => {
                if (value) {
                  dispatch(setMapType(value as MapType));
                }
              }}
              mt="md"
              size="sm"
            />
          </Paper>
        </AppShell.Navbar>

        <AppShell.Main>
          <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <Tabs defaultValue="stats" style={{ flexShrink: 0 }} onChange={handleTabChange}>
              <Tabs.List>
                <Tabs.Tab value="stats">Stats</Tabs.Tab>
                <Tabs.Tab value="playback">Playback</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="stats" pt="xs" pb="md">
                <Stack style={{ flex: 1, marginTop: 'md' }}>
                  <FlightStatsDisplay />
                  <ModeColorKey />
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="playback" pt="xs" pb="md">
                <Stack style={{ flex: 1, marginTop: 'md' }}>
                  <PlaybackControls />
                </Stack>
              </Tabs.Panel>
            </Tabs>
            <EarthViewer />
          </div>
        </AppShell.Main>
      </AppShell>
      <ExportModal opened={exportModalOpened} close={closeExportModal} />
    </>
  );
}
