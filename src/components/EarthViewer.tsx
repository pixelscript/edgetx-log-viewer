import "@mantine/core/styles.css";
import { Paper } from "@mantine/core";
// useSelector, RootState, selectSelectedMapSourceId, mapSources are no longer needed here
import Earth from "../components/Earth";


export default function EarthViewer() {
  // The logic for selecting texture or map source is now handled within EarthSphere.tsx

  return <Paper shadow="xs" p="md" withBorder style={{ flex: 1 }}>
    <Earth /></Paper>
}
