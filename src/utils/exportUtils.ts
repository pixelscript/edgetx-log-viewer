import { LogEntry, GPS } from '../state/types/logTypes';
import { LoadedLog } from '../state/types';

const getValue = (entry: LogEntry, keys: string[]): any | undefined => {
  for (const key of keys) {
    if (entry[key] !== undefined) {
      return entry[key];
    }
  }
  return undefined;
};

const parseTimeToMs = (entry: LogEntry): number | null => {
  const dateStr = entry.date;
  const timeStr = entry.time;
  if (typeof dateStr === 'string' && typeof timeStr === 'string') {
    let dateTimeString = `${dateStr}T${timeStr}`;
    if (!timeStr.includes('Z') && !timeStr.includes('+') && !timeStr.includes('-')) {
      dateTimeString += 'Z';
    }
    let date = new Date(dateTimeString);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
    dateTimeString = `${dateStr} ${timeStr}`;
    if (!timeStr.includes('Z') && !timeStr.includes('+') && !timeStr.includes('-')) {
      dateTimeString += 'Z';
    }
    date = new Date(dateTimeString);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  const timeValue = getValue(entry, ['timestamp', 'dateTime', 'Time(ms)']);
  if (timeValue !== undefined) {
    if (typeof timeValue === 'number') {
      if (timeValue > 1000000000 && timeValue < 2000000000) {
        return timeValue * 1000;
      }
      if (timeValue > 10000000000) {
        return timeValue;
      }
      return timeValue;

    }
    if (typeof timeValue === 'string') {
      const date = new Date(timeValue);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
  }
  return null;
};


export function generateGpx(log: LoadedLog, offset: number): string {
  const { filename, entries, modelName } = log;
  let trackPoints = '';

  for (const entry of entries) {
    const gpsValue = getValue(entry, ['gps']) as GPS | undefined;
    const altitudeValue = getValue(entry, ['altitude', 'alt', 'altMeters', 'altitudeMeters', 'Alt(m)']);
    const timestampMs = parseTimeToMs(entry);

    if (gpsValue && typeof gpsValue === 'object' && gpsValue.lat != null && gpsValue.long != null && timestampMs !== null) {
      const lat = gpsValue.lat;
      const lon = gpsValue.long;
      const ele = (typeof altitudeValue === 'number' ? altitudeValue + offset : null);
      const time = new Date(timestampMs).toISOString();

      trackPoints += `
      <trkpt lat="${lat}" lon="${lon}">`;
      if (ele !== null) {
        trackPoints += `<ele>${ele.toFixed(2)}</ele>`;
      }
      trackPoints += `<time>${time}</time>
      </trkpt>`;
    }
  }

  if (!trackPoints) {
    return '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="EdgeTX Log Viewer"><metadata><name>No GPS data found</name></metadata></gpx>';
  }


  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"
  creator="EdgeTX Log Viewer"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${modelName || filename} - Altitude Offset: ${offset}m</name>
    <desc>Flight log exported from EdgeTX Log Viewer</desc>
  </metadata>
  <trk>
    <name>${modelName || filename}</name>
    <trkseg>${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}


export function generateKml(log: LoadedLog, offset: number): string {
  const { filename, entries, modelName } = log;
  let coordinates = '';

  for (const entry of entries) {
    const gpsValue = getValue(entry, ['gps']) as GPS | undefined;
    const altitudeValue = getValue(entry, ['altitude', 'alt', 'altMeters', 'altitudeMeters', 'Alt(m)']);

    if (gpsValue && typeof gpsValue === 'object' && gpsValue.lat != null && gpsValue.long != null) {
      const lat = gpsValue.lat;
      const lon = gpsValue.long;
      const alt = (typeof altitudeValue === 'number' ? altitudeValue + offset : 0);
      coordinates += `${lon},${lat},${alt.toFixed(2)} `;
    }
  }

  if (!coordinates) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>No GPS data found</name>
  </Document>
</kml>`;
  }

  coordinates = coordinates.trim();

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${modelName || filename} - Altitude Offset: ${offset}m</name>
    <description>Flight log exported from EdgeTX Log Viewer</description>
    <Style id="flightPathStyle">
      <LineStyle>
        <color>ff007eff</color> <!-- Blue-ish color -->
        <width>4</width>
      </LineStyle>
      <PolyStyle>
        <color>7f007eff</color> <!-- Semi-transparent fill -->
      </PolyStyle>
    </Style>
    <Placemark>
      <name>${modelName || filename}</name>
      <styleUrl>#flightPathStyle</styleUrl>
      <LineString>
        <extrude>1</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>absolute</altitudeMode> <!-- Use absolute altitude -->
        <coordinates>${coordinates}</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
}