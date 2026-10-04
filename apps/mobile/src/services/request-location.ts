type Position = { timestamp: number; coords: { latitude: number; longitude: number; accuracy: number | null } };
type LocationReader = {
  requestForegroundPermissionsAsync(): Promise<{ status: string }>;
  getCurrentPositionAsync(options: object): Promise<Position>;
};

export function verifiedCoordinates(position: Position, now = Date.now()): { latitude: number | null; longitude: number | null } {
  const { latitude, longitude, accuracy } = position.coords;
  // Pilot guardrails, not a claim of indoor positioning accuracy.
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180
    || accuracy === null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100
    || !Number.isFinite(position.timestamp) || now - position.timestamp > 60000 || position.timestamp > now + 5000) {
    return { latitude: null, longitude: null };
  }
  return { latitude, longitude };
}

export async function requestCoordinates(reader: LocationReader, timeoutMs = 8000) {
  const unknown = { latitude: null, longitude: null };
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      (async () => {
        if ((await reader.requestForegroundPermissionsAsync()).status !== 'granted') return unknown;
        return verifiedCoordinates(await reader.getCurrentPositionAsync({}));
      })(),
      new Promise<typeof unknown>(resolve => { timer = setTimeout(() => resolve(unknown), timeoutMs); }),
    ]);
  } catch { return unknown; }
  finally { clearTimeout(timer!); }
}
