export interface LogValueInfo {
  title: string;
  description: string;
  unit?: string;
}

export const logValueTitles: Record<string, LogValueInfo> = {
  // Receiver Telemetry (RX → TX)
  '1Rss': { title: 'RSSI 1', description: 'Signal strength from antenna 1 on the receiver', unit: 'dB' },
  '2Rss': { title: 'RSSI 2', description: 'Signal strength from antenna 2 on the receiver', unit: 'dB' },
  rqly: { title: 'RX Link Quality', description: 'How clean/complete the packets are from the radio to the receiver', unit: '%' },
  rsnr: { title: 'RX SNR', description: 'Signal-to-noise ratio of the received signal', unit: 'dB' },
  ant: { title: 'Antenna', description: 'Which antenna is being used (e.g., 0 or 1)' },
  rfmd: { title: 'RF Mode', description: 'RF mode (e.g., 0 = 4Hz, 2 = 50Hz, 3 = 150Hz)' },
  tpwr: { title: 'TX Power', description: 'Transmit power (from receiver to transmitter)', unit: 'mW' },
  trss: { title: 'Telemetry RSSI', description: 'Signal strength from drone back to radio', unit: 'dB' },
  tqly: { title: 'Telemetry Link Quality', description: 'How good the telemetry link is (drone → radio)', unit: '%' },
  tsnr: { title: 'Telemetry SNR', description: 'Telemetry Signal-to-Noise Ratio', unit: 'dB' },

  // Power & Battery
  rxBt: { title: 'Receiver Voltage', description: 'Voltage on the receiver (drone-side)', unit: 'V' },
  curr: { title: 'Current', description: 'Current draw', unit: 'A' },
  capa: { title: 'Capacity Used', description: 'Battery capacity used so far', unit: 'mAh' },
 'bat%': { title: 'Battery', description: 'Battery percentage (if monitored by FC)', unit: '%' },
  txBat: { title: 'Transmitter Voltage', description: 'Voltage of the transmitter (radio battery)', unit: 'V' },

  // Attitude / Orientation
  ptch: { title: 'Pitch', description: 'Pitch of the aircraft (nose up/down)', unit: 'rad' },
  roll: { title: 'Roll', description: 'Roll of the aircraft (tilting side-to-side)', unit: 'rad' },
  yaw: { title: 'Yaw', description: 'Yaw of the aircraft (heading left/right)', unit: 'rad' },

  // Flight / GPS
  fm: { title: 'Flight Mode', description: 'Flight Mode (e.g., "ACRO", "ANGLE")' },
  vspd: { title: 'Vertical Speed', description: 'Vertical speed (climb or descent)', unit: 'm/s' },
  gps: { title: 'GPS location', description: '' },
  gspd: { title: 'Ground Speed', description: 'Ground speed from GPS', unit: 'km/h' }, // Note: Unit corrected from input
  hdg: { title: 'Heading', description: 'Heading from GPS', unit: '°' },
  alt: { title: 'Altitude', description: 'Altitude (from barometer or GPS)', unit: 'm' },
  sats: { title: 'Satellites', description: 'Number of satellites locked' },

  // RC Inputs & Switches
  rud: { title: 'Rudder Input', description: 'Stick position for Rudder' },
  ele: { title: 'Elevator Input', description: 'Stick position for Elevator' },
  thr: { title: 'Throttle Input', description: 'Stick position for Throttle' },
  ail: { title: 'Aileron Input', description: 'Stick position for Aileron' },
  p1: { title: 'Potentiometer 1', description: 'Potentiometer 1 input' },
  sa: { title: 'Switch A', description: 'Position of Switch A' },
  sb: { title: 'Switch B', description: 'Position of Switch B' },
  sc: { title: 'Switch C', description: 'Position of Switch C' },
  sd: { title: 'Switch D', description: 'Position of Switch D' },
  se: { title: 'Switch E', description: 'Position of Switch E' },
  lsw: { title: 'Logical Switch', description: 'Logical switch state' },
};

// Add other common log values if needed
logValueTitles.date = { title: 'Date', description: 'Date of the log entry' };
logValueTitles.time = { title: 'Time', description: 'Time of the log entry' };
logValueTitles.gpsLat = { title: 'Latitude', description: 'GPS Latitude', unit: '°' };
logValueTitles.gpsLon = { title: 'Longitude', description: 'GPS Longitude', unit: '°' };