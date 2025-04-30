import "@mantine/core/styles.css";
import { Paper } from "@mantine/core";
import Earth from "../components/Earth";

export default function EarthViewer() {

  const satelliteTextureUrl = 'earthmap8k.jpg';

  return <Paper shadow="xs" p="md" withBorder style={{ flex: 1 }}>
    <Earth textureUrl={satelliteTextureUrl} /></Paper>
}
