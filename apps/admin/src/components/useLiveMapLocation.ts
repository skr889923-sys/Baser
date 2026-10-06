"use client";

import { useEffect, useState } from 'react';
import { isLocationFresh, locationErrorMessage, readMapLocation, type MapLocation } from '../lib/live-map-location';

export function useLiveMapLocation() {
  const [enabled, setEnabled] = useState(false);
  const [position, setPosition] = useState<MapLocation | null>(null);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setError(!window.isSecureContext
        ? 'الموقع المباشر يحتاج اتصال HTTPS آمنًا أو التشغيل على localhost.'
        : 'هذا المتصفح لا يدعم تحديد الموقع. استخدم متصفحًا يدعم خدمات الموقع.');
      setEnabled(false);
      return;
    }

    let watchId: number | null = null;
    let generation = 0;
    const stopWatch = () => {
      generation++;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
    };
    const watch = () => {
      stopWatch();
      setPosition(null);
      const hidden = document.visibilityState === 'hidden';
      setPaused(hidden);
      if (hidden) return;
      setError('');
      const current = generation;
      watchId = navigator.geolocation.watchPosition(sample => {
        if (current !== generation) return;
        const reading = readMapLocation(sample);
        if (!reading) {
          setPosition(null);
          setError('وصلت قراءة غير صالحة أو قديمة. ننتظر قراءة حديثة للموقع.');
          return;
        }
        setPosition(reading);
        setNow(Date.now());
        setError('');
      }, cause => {
        if (current !== generation) return;
        setPosition(null);
        setError(locationErrorMessage(cause.code));
        if (cause.code === 1) { stopWatch(); setEnabled(false); }
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
    };

    watch();
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    document.addEventListener('visibilitychange', watch);
    window.addEventListener('pagehide', stopWatch);
    return () => {
      stopWatch();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', watch);
      window.removeEventListener('pagehide', stopWatch);
    };
  }, [enabled]);

  const start = () => { setPosition(null); setError(''); setPaused(false); setNow(Date.now()); setEnabled(true); };
  const stop = () => { setEnabled(false); setPosition(null); setPaused(false); setError(''); };
  const fresh = Boolean(enabled && !paused && !error && position && isLocationFresh(position, now));
  return { enabled, position, fresh, error, paused, now, start, stop };
}
