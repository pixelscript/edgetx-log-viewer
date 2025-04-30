function latLongToOffset(lat: number, lon: number, originLat: number, originLon: number) {
  const R = 6371e3; // Earth radius in meters
  const toRad = (x: number) => x * Math.PI / 180;

  const x = (lon - originLon) * Math.cos(toRad(originLat)) * (Math.PI / 180) * R;
  const z = (lat - originLat) * (Math.PI / 180) * R;
  return [x, z];
}