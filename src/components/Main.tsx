import "@mantine/core/styles.css";
import { AppShell, Burger, Group, Text, Stack, Title, Button, Tabs, Select, Paper, ActionIcon, Pill, Switch } from "@mantine/core";
import { useDisclosure } from '@mantine/hooks';
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../state/store";
import { setViewMode, ViewMode, selectMapType, setMapType, selectShowTerrain, setShowTerrain } from "../state/uiSlice";
import { MapType } from "../consts/earth";
import LogFileUploader from "./LogFileUploader";
import LogSelectorTable from "./LogSelectorTable";
import EarthViewer from "./EarthViewer";
import ModeColorKey from "./ModeColorKey";
import PlaybackControls from "./PlaybackControls";
import FlightStatsDisplay from "./FlightStatsDisplay";
import { IconDownload, IconBrandGithub } from '@tabler/icons-react';
import '@mantine/dropzone/styles.css';
import ExportModal from './ExportModal';
import { ThemeToggle } from './ThemeToggle';
import FileSettingsPanel from './FileSettingsPanel';

export default function Main() {
  const [navbarOpened, { toggle: toggleNavbar }] = useDisclosure(false);
  const [exportModalOpened, { open: openExportModal, close: closeExportModal }] = useDisclosure(false);
  const selectedLogFilename = useSelector((state: RootState) => state.logs.selectedLogFilename);
  const dispatch = useDispatch();
  const currentMapType = useSelector(selectMapType);
  const showTerrain = useSelector(selectShowTerrain);

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
        navbar={{ width: 570, breakpoint: 'sm', collapsed: { mobile: !navbarOpened, desktop: false } }}
      >
        <AppShell.Header>
          <Group h="100%" px="md">
            <Burger opened={navbarOpened} onClick={toggleNavbar} hiddenFrom="sm" size="sm" />
            <img src="./logo.png" alt="A blue squiggle with and orange triangle at the end" style={{ height: 40 }} />
            <Title order={3} visibleFrom="md">EdgeTX Log Viewer</Title>
            <Title order={3} hiddenFrom="md">Log Viewer</Title>
            <Pill size="xs" color="red" style={{ backgroundColor: '#e94848c5', marginLeft: '-5px' }}>
              BETA
            </Pill>
            {selectedLogFilename && (
              <Text size="sm" c="dimmed" ml="md" visibleFrom="md"> - {selectedLogFilename}</Text>
            )}
            <Group justify="flex-end" style={{ flex: 1 }}>
              <ActionIcon
                variant="default"
                size="lg"
                aria-label="Visit GitHub repository"
                onClick={() => window.open("https://github.com/pixelscript/edgetx-log-viewer", "_blank")}
                visibleFrom="lg"
              >
                <IconBrandGithub size={20} />
              </ActionIcon>
              <ThemeToggle />
              {selectedLogFilename && (
                <>
                  <Button
                    variant="light"
                    leftSection={<IconDownload size={14} />}
                    onClick={openExportModal}
                    visibleFrom="md"
                  >
                    Export Log
                  </Button>
                  <Button
                    variant="light"
                    onClick={openExportModal}
                    hiddenFrom="md"
                  >
                    <IconDownload size={14} />
                  </Button>
                </>
              )}
            </Group>

          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="md">
          <Paper withBorder shadow="sm" p="sm" mb="md">
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
            <Switch
              label="3D Terrain"
              checked={showTerrain}
              onChange={(event) => dispatch(setShowTerrain(event.currentTarget.checked))}
              mt="md"
              size="sm"
            />
          </Paper>
          <FileSettingsPanel />
          <LogSelectorTable />
          <LogFileUploader />
        </AppShell.Navbar>

        <AppShell.Main>
          <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <Tabs defaultValue="stats" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} onChange={handleTabChange}>
              <Tabs.List style={{ flexShrink: 0 }}>
                <Tabs.Tab value="stats">Stats</Tabs.Tab>
                <Tabs.Tab value="playback">Playback</Tabs.Tab>
              </Tabs.List>

              <EarthViewer />

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
          </div>
        </AppShell.Main>
      </AppShell>
      <ExportModal opened={exportModalOpened} close={closeExportModal} />
    </>
  );
}
