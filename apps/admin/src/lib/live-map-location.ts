// Field capture thresholds, not a guarantee of positioning or survey accuracy.
export const LOCATION_MAX_AGE_MS = 15_000;
export const LOCATION_CAPTURE_ACCURACY_METERS = 10;

export type MapLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export function readMapLocation(position: GeolocationPosition, now = Date.now()): MapLocation | null {
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90
    || !Number.isFinite(longitude) || Math.abs(longitude) > 180
    || !Number.isFinite(accuracy) || accuracy < 0
    || !Number.isFinite(position.timestamp) || position.timestamp > now + 5_000
    || now - position.timestamp > LOCATION_MAX_AGE_MS) return null;
  return { latitude, longitude, accuracy, timestamp: position.timestamp };
}

export function isLocationFresh(location: MapLocation, now = Date.now()): boolean {
  return location.timestamp <= now + 5_000 && now - location.timestamp <= LOCATION_MAX_AGE_MS;
}

export function canCaptureLocation(location: MapLocation | null, now = Date.now()): boolean {
  return Boolean(location && isLocationFresh(location, now)
    && location.accuracy <= LOCATION_CAPTURE_ACCURACY_METERS);
}

export function locationErrorMessage(code: number): string {
  if (code === 1) return 'لم يُسمح بالوصول إلى موقعك. فعّل إذن الموقع من إعدادات المتصفح ثم أعد المحاولة.';
  if (code === 2) return 'تعذر تحديد موقعك. جرّب مكانًا مفتوحًا وتأكد من تشغيل خدمات الموقع.';
  return 'لم تصل قراءة للموقع في الوقت المحدد. سيواصل الجهاز المحاولة؛ يمكنك إيقافه وتشغيله مجددًا.';
}
