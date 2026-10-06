"use client";

import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline, Circle, CircleMarker, ScaleControl, ZoomControl } from 'react-leaflet';
import { Check, Crosshair, Layers, Loader2, MapPin, Navigation, Route as RouteIcon, Satellite, Save, X } from 'lucide-react';
import L from 'leaflet';
import { supabase } from '../lib/supabase';
import { requireMapEditorAccess, mapWriteError } from '../lib/map-permissions';
import { saveRouteWithFirstStep } from '../lib/save-route';
import { canCaptureLocation, LOCATION_CAPTURE_ACCURACY_METERS, type MapLocation } from '../lib/live-map-location';
import { useLiveMapLocation } from './useLiveMapLocation';
import type { NavigationPoint, Route, RouteType } from '@baser/types';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const SUEZ_CANAL_UNIV_CENTER: [number, number] = [30.622971, 32.269073];
const arcgisKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;
const SATELLITE_URL = arcgisKey
  ? `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(arcgisKey)}`
  : 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_ATTRIBUTION = 'Imagery &copy; <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener noreferrer">Esri World Imagery</a>, Vantor, Earthstar Geographics, and the GIS User Community';

function MapViewport({ mapRef, position, follow, onStopFollowing }: {
  mapRef: React.MutableRefObject<L.Map | null>;
  position: MapLocation | null;
  follow: boolean;
  onStopFollowing: () => void;
}) {
  const map = useMap();
  useMapEvents({ dragstart: onStopFollowing });
  useEffect(() => {
    mapRef.current = map;
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false, debounceMoveend: true }));
    observer.observe(map.getContainer());
    return () => { observer.disconnect(); mapRef.current = null; };
  }, [map, mapRef]);
  useEffect(() => {
    if (follow && position) map.panTo([position.latitude, position.longitude], { animate: false });
  }, [map, position, follow]);
  return null;
}

function LiveLocationMarker({ position, fresh }: { position: MapLocation; fresh: boolean }) {
  const center: [number, number] = [position.latitude, position.longitude];
  const color = fresh ? '#0284c7' : '#64748b';
  return <>
    <Circle center={center} radius={position.accuracy} interactive={false} pathOptions={{ color, weight: 1, fillOpacity: 0.12 }} />
    <CircleMarker center={center} radius={8} bubblingMouseEvents={false} pathOptions={{ color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 1 }}>
      <Popup><div dir="rtl">{fresh ? 'موقع جهازك الحالي' : 'آخر موقع — القراءة قديمة'}<br />هامش الدقة: ±{Math.ceil(position.accuracy)} متر</div></Popup>
    </CircleMarker>
  </>;
}

function MapEvents({ onMapClick }: { onMapClick: (e: L.LeafletMouseEvent) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e);
    },
  });
  return null;
}

// Haversine distance formula
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI/180;
  const phi2 = lat2 * Math.PI/180;
  const deltaPhi = (lat2-lat1) * Math.PI/180;
  const deltaLambda = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c); // in metres
}

type EditorMode = 'browse' | 'add_point' | 'add_route';

function hasCoordinates(point: NavigationPoint): boolean {
  return typeof point.latitude === 'number' && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90
    && typeof point.longitude === 'number' && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}

export default function MapEditorMap() {
  const [points, setPoints] = useState<NavigationPoint[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const [basemap, setBasemap] = useState<'streets' | 'satellite'>('streets');
  const [tileError, setTileError] = useState(false);
  const [showPoints, setShowPoints] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [followLocation, setFollowLocation] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const live = useLiveMapLocation();
  
  const [mode, setMode] = useState<EditorMode>('browse');

  // Point Form State
  const [newPointLocation, setNewPointLocation] = useState<[number, number] | null>(null);
  const [capturedLocation, setCapturedLocation] = useState<MapLocation | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [pointType, setPointType] = useState<string>('entrance');

  // Route Form State
  const [routeStart, setRouteStart] = useState<NavigationPoint | null>(null);
  const [routeEnd, setRouteEnd] = useState<NavigationPoint | null>(null);
  const [routeNameAr, setRouteNameAr] = useState('');
  const [routeNameEn, setRouteNameEn] = useState('');
  const [routeType, setRouteType] = useState<RouteType>('blind_friendly');
  const [hasStairs, setHasStairs] = useState(false);
  const [hasRamp, setHasRamp] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [pointResult, routeResult] = await Promise.all([
        supabase.from('navigation_points').select('*'),
        supabase.from('routes').select('*'),
      ]);
      if (pointResult.error || routeResult.error) throw new Error('تعذر تحميل بعض النقاط أو المسارات. أعد المحاولة قبل متابعة التحرير.');
      setPoints(pointResult.data || []);
      setRoutes(routeResult.data || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'تعذر تحميل بيانات الخريطة. أعد المحاولة.');
    } finally { setLoading(false); }
  };

  const handleMapClick = (e: L.LeafletMouseEvent) => {
    if (mode === 'add_point' && !saving) {
      setNewPointLocation([e.latlng.lat, e.latlng.lng]);
      setCapturedLocation(null);
      setFollowLocation(false);
      setNotice('');
      setSaveError('');
      if (!newPointLocation) { setNameAr(''); setNameEn(''); setPointType('entrance'); }
    }
  };

  const handleMarkerClick = (pt: NavigationPoint) => {
    if (mode === 'add_route' && !saving) {
      if (!routeStart) {
        setRouteStart(pt);
      } else if (!routeEnd && pt.id !== routeStart.id) {
        setRouteEnd(pt);
      }
    }
  };

  const handleSavePoint = async () => {
    if (!newPointLocation || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await requireMapEditorAccess(supabase);
      const { error } = await supabase.from('navigation_points').insert([{
        name_ar: nameAr || 'نقطة جديدة',
        name_en: nameEn || 'New Point',
        type: pointType,
        latitude: newPointLocation[0],
        longitude: newPointLocation[1],
        description_ar: capturedLocation
          ? `تم إنشاؤه عبر لوحة التحكم من قراءة موقع الجهاز بتاريخ ${new Date(capturedLocation.timestamp).toISOString()}، بهامش دقة ±${Math.ceil(capturedLocation.accuracy)} متر؛ يتطلب تحققًا ميدانيًا.`
          : 'تم إنشاؤه عبر لوحة التحكم',
        description_en: capturedLocation
          ? `Created via admin panel from device location at ${new Date(capturedLocation.timestamp).toISOString()}, accuracy +/-${Math.ceil(capturedLocation.accuracy)} m; field verification required.`
          : 'Created via admin panel',
        audio_instruction_ar: '',
        audio_instruction_en: '',
        is_accessible: true,
        is_hazard: false,
        is_active: true
      }]);

      if (error) setSaveError(mapWriteError(error));
      else {
        setNotice('تم حفظ النقطة.');
        setNewPointLocation(null);
        setCapturedLocation(null);
        fetchData();
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'تعذر الاتصال لحفظ النقطة. أعد المحاولة.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoute = async () => {
    if (!routeStart || !routeEnd || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await requireMapEditorAccess(supabase);

      const distance = getDistance(
        routeStart.latitude!, routeStart.longitude!,
        routeEnd.latitude!, routeEnd.longitude!
      );
      // rough estimation: avg walking speed 1.4 m/s -> 84 m / min
      const estimatedMinutes = Math.max(1, Math.round(distance / 84));

      await saveRouteWithFirstStep(supabase, {
        start_point_id: routeStart.id,
        end_point_id: routeEnd.id,
        name_ar: routeNameAr || `مسار من ${routeStart.name_ar} إلى ${routeEnd.name_ar}`,
        name_en: routeNameEn || `Route from ${routeStart.name_en} to ${routeEnd.name_en}`,
        route_type: routeType,
        distance_meters: distance,
        estimated_minutes: estimatedMinutes,
        has_stairs: hasStairs,
        has_ramp: hasRamp,
        wheelchair_accessible: !hasStairs || hasRamp,
        visually_impaired_friendly: true,
        status: 'active'
      }, {
        instruction_ar: `توجه من ${routeStart.name_ar} إلى ${routeEnd.name_ar} لمسافة ${distance} متر.`,
        instruction_en: `Proceed from ${routeStart.name_en} to ${routeEnd.name_en} for ${distance} meters.`,
        direction: 'straight',
        haptic_pattern: 'continue',
        warning_level: hasStairs ? 'caution' : 'none'
      });
      setNotice('تم حفظ المسار.');
      setRouteStart(null);
      setRouteEnd(null);
      setRouteNameAr('');
      setRouteNameEn('');
      fetchData();
    } catch (error) {
      setSaveError(mapWriteError(error));
    } finally {
      setSaving(false);
    }
  };

  const cancelRoute = () => {
    setRouteStart(null);
    setRouteEnd(null);
  };

  // Helper to get coordinates for existing routes
  const getRouteCoordinates = (route: Route): [number, number][] => {
    const start = points.find(p => p.id === route.start_point_id);
    const end = points.find(p => p.id === route.end_point_id);
    if (start && end && hasCoordinates(start) && hasCoordinates(end)) {
      return [
        [start.latitude!, start.longitude!],
        [end.latitude!, end.longitude!]
      ];
    }
    return [];
  };

  const hasVisibleEditorPanel = mode === 'add_route' || Boolean(newPointLocation);
  const visiblePoints = points.filter(hasCoordinates);
  const canUseLocation = live.fresh && canCaptureLocation(live.position, live.now);
  const switchMode = (next: EditorMode) => {
    setMode(next); cancelRoute(); setNewPointLocation(null); setCapturedLocation(null); setSaveError(''); setNotice('');
    if (next === 'add_route') setShowPoints(true);
  };
  const captureCurrentLocation = () => {
    if (!live.fresh || !canCaptureLocation(live.position) || !live.position) return;
    setMode('add_point'); cancelRoute(); setNameAr(''); setNameEn(''); setPointType('entrance');
    setNewPointLocation([live.position.latitude, live.position.longitude]);
    setCapturedLocation({ ...live.position });
    setFollowLocation(false); setSaveError(''); setNotice('');
    mapRef.current?.setView([live.position.latitude, live.position.longitude], 19);
  };
  const focusLocation = () => {
    setFollowLocation(true);
    if (live.fresh && live.position) mapRef.current?.setView([live.position.latitude, live.position.longitude], 18);
    if (!live.enabled) live.start();
  };

  return (
    <div className="flex flex-col h-full min-h-0 w-full relative">
      {saveError && <p role="alert" className="bg-red-50 text-red-800 border-b border-red-200 p-4 font-semibold">{saveError}</p>}
      {notice && <p role="status" className="flex items-center gap-2 border-b border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800"><Check size={16} aria-hidden="true" />{notice}</p>}
      {loadError && <div role="alert" className="flex items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}<button className="secondary-action shrink-0" onClick={fetchData} disabled={loading}>إعادة المحاولة</button></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white p-3 sm:p-4">
        <div className="map-segment" role="group" aria-label="وضع محرر الخريطة">
          {([{ value: 'browse', label: 'استكشاف', Icon: Navigation }, { value: 'add_point', label: 'إضافة نقطة', Icon: MapPin }, { value: 'add_route', label: 'رسم مسار', Icon: RouteIcon }] as const).map(({ value, label, Icon }) => (
            <button key={value} aria-pressed={mode === value} onClick={() => switchMode(value)} disabled={saving} className="map-segment-button disabled:opacity-50"><Icon size={16} aria-hidden="true" />{label}</button>
          ))}
        </div>
        <div className="map-segment" role="group" aria-label="نوع الخريطة">
          <button aria-pressed={basemap === 'streets'} className="map-segment-button" onClick={() => { setBasemap('streets'); setTileError(false); }}><Layers size={16} aria-hidden="true" />شوارع</button>
          <button aria-pressed={basemap === 'satellite'} className="map-segment-button" onClick={() => { setBasemap('satellite'); setTileError(false); }}><Satellite size={16} aria-hidden="true" />قمر صناعي</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2.5 sm:px-4">
        <button className="secondary-action" aria-pressed={live.enabled && followLocation} onClick={focusLocation}>
          {live.enabled && !live.position && !live.error ? <Loader2 className="animate-spin motion-reduce:animate-none" size={16} aria-hidden="true" /> : <Crosshair size={16} aria-hidden="true" />}
          {live.enabled ? 'التمركز على موقعي' : 'تشغيل موقعي المباشر'}
        </button>
        {live.enabled && <button className="map-text-action" onClick={() => { live.stop(); setFollowLocation(false); }}><X size={14} aria-hidden="true" />إيقاف الموقع</button>}
        <button className="map-text-action" onClick={() => { setFollowLocation(false); mapRef.current?.setView(SUEZ_CANAL_UNIV_CENTER, 18); }}>الحرم الجامعي</button>
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 sm:mr-auto">
          <label className="flex min-h-11 cursor-pointer items-center gap-2"><input className="accent-teal-700" type="checkbox" checked={showPoints} onChange={e => setShowPoints(e.target.checked)} />النقاط {loading ? '…' : visiblePoints.length}</label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2"><input className="accent-teal-700" type="checkbox" checked={showRoutes} onChange={e => setShowRoutes(e.target.checked)} />المسارات {loading ? '…' : routes.length}</label>
        </div>
      </div>
      {(live.enabled || live.error) && <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p role="status" className={`text-sm font-semibold ${live.error || (live.position && !live.fresh) ? 'text-amber-800' : 'text-slate-800'}`}>
              {live.error || (live.paused ? 'توقف تحديد الموقع مؤقتًا أثناء مغادرة الصفحة.' : !live.position ? 'ننتظر موقعًا حديثًا من جهازك…' : !live.fresh ? 'قراءة الموقع قديمة؛ ننتظر تحديثًا قبل استخدامها.' : `موقع مباشر · هامش الدقة ±${Math.ceil(live.position.accuracy)} متر${followLocation ? ' · متابعة مفعّلة' : ''}`)}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">الدائرة على الخريطة تمثل هامش الدقة. اقتراح نقطة يتطلب قراءة حديثة بهامش لا يتجاوز {LOCATION_CAPTURE_ACCURACY_METERS} أمتار، ثم مراجعة موقعها ميدانيًا.</p>
          </div>
          {live.enabled && <button className="primary-action disabled:cursor-not-allowed disabled:opacity-40" disabled={!canUseLocation || saving} onClick={captureCurrentLocation}><MapPin size={15} aria-hidden="true" />اقتراح نقطة من موقعي</button>}
        </div>
      </div>}
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 text-xs leading-5 text-slate-500">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" aria-hidden="true" />
        {mode === 'browse' ? 'استكشف الخريطة، أو اختر إضافة نقطة لبدء التحرير.' : mode === 'add_point' ? 'انقر لتحديد نقطة، ثم اسحب علامتها لضبط الموقع قبل الحفظ.' : 'اختر نقطة البداية ثم نقطة النهاية. الخط المعروض اتصال مباشر بينهما.'}
        {basemap === 'satellite' && <span className="hidden md:inline">· الصور مرجعية وقد لا تعكس التغييرات الأخيرة.</span>}
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row relative overflow-visible md:overflow-hidden">
        {/* Map Area */}
        <div className={`${hasVisibleEditorPanel ? 'h-[32dvh] min-h-[13rem]' : 'h-[46dvh] min-h-[18rem]'} md:h-auto md:flex-1 md:min-h-0 relative z-0 overflow-hidden`}>
          {tileError && <div role="alert" className="absolute left-3 right-3 top-3 z-[500] rounded-xl border border-amber-200 bg-white/95 p-3 text-xs leading-5 text-amber-900 shadow-sm">تعذر تحميل بعض أجزاء الخريطة. تحقق من الاتصال أو جرّب عرض {basemap === 'satellite' ? 'الشوارع' : 'القمر الصناعي'}.</div>}
          <MapContainer className="admin-editor-map" center={SUEZ_CANAL_UNIV_CENTER} zoom={18} maxZoom={20} zoomControl={false}>
            <TileLayer
              key={basemap}
              attribution={basemap === 'satellite' ? SATELLITE_ATTRIBUTION : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
              url={basemap === 'satellite' ? SATELLITE_URL : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}
              maxNativeZoom={19}
              maxZoom={20}
              eventHandlers={{ tileerror: () => setTileError(true) }}
            />
            <ZoomControl position="bottomright" zoomInTitle="تكبير الخريطة" zoomOutTitle="تصغير الخريطة" />
            <ScaleControl position="bottomleft" imperial={false} />
            <MapViewport mapRef={mapRef} position={live.fresh ? live.position : null} follow={followLocation} onStopFollowing={() => setFollowLocation(false)} />
            <MapEvents onMapClick={handleMapClick} />
            {live.enabled && live.position && <LiveLocationMarker position={live.position} fresh={live.fresh} />}
            
            {/* Existing Points */}
            {showPoints && visiblePoints.map((pt) => (
              <Marker 
                key={pt.id} 
                position={[pt.latitude!, pt.longitude!]}
                bubblingMouseEvents={false}
                eventHandlers={{ click: () => handleMarkerClick(pt) }}
              >
                <Popup>
                  <div className="font-bold text-slate-800">{pt.name_ar}</div>
                  <div className="text-slate-500 text-xs mb-1">{pt.type}</div>
                  {mode === 'add_route' && (
                    <div className="text-[10px] text-amber-600 font-bold mt-1">انقر لتحديده في المسار</div>
                  )}
                </Popup>
              </Marker>
            ))}

            {/* Existing Routes */}
            {showRoutes && routes.map((rt) => {
              const coords = getRouteCoordinates(rt);
              if (coords.length > 0) {
                return <Polyline key={rt.id} positions={coords} pathOptions={{ color: basemap === 'satellite' ? '#5eead4' : '#176d66', weight: 5, opacity: 0.8 }} interactive={false} />;
              }
              return null;
            })}

            {/* Temporary New Point Marker */}
            {mode === 'add_point' && newPointLocation && (
              <Marker position={newPointLocation} draggable={!saving} bubblingMouseEvents={false} eventHandlers={{ dragend: e => {
                const location = (e.target as L.Marker).getLatLng();
                setNewPointLocation([location.lat, location.lng]); setCapturedLocation(null); setFollowLocation(false);
              } }}>
                <Popup>موقع النقطة الجديدة</Popup>
              </Marker>
            )}

            {/* Temporary Route Line */}
            {mode === 'add_route' && routeStart && routeEnd && (
              <Polyline 
                positions={[
                  [routeStart.latitude!, routeStart.longitude!], 
                  [routeEnd.latitude!, routeEnd.longitude!]
                ]} 
                color="#F59E0B" 
                weight={6} 
                dashArray="10, 10"
                interactive={false}
              />
            )}
            
            {/* Highlight Selected Start Point */}
            {mode === 'add_route' && routeStart && (
              <Marker position={[routeStart.latitude!, routeStart.longitude!]} opacity={0.8} bubblingMouseEvents={false}>
                <Popup>نقطة البداية المحددة</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Sidebar: Add Point Form */}
        {mode === 'add_point' && newPointLocation && (
          <div className="w-full md:w-96 bg-white border-t md:border-t-0 md:border-r border-slate-200 shadow-xl z-10 flex flex-col shrink-0 md:h-full">
            <div className="p-5 border-b border-slate-100 shrink-0 bg-slate-50">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800"><MapPin size={19} aria-hidden="true" />إضافة نقطة جديدة</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">راجع العلامة على الخريطة؛ الحفظ يعتمد الموقع المحدد هنا.</p>
            </div>
            
            <div className="p-5 overflow-visible md:overflow-y-auto md:flex-1 flex flex-col">
              <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="mb-2 font-semibold">{capturedLocation ? `موقع الجهاز · هامش الدقة ±${Math.ceil(capturedLocation.accuracy)} متر` : 'موقع محدد يدويًا'}</p>
                <p dir="ltr" className="font-mono tabular-nums">{newPointLocation[0].toFixed(6)}, {newPointLocation[1].toFixed(6)}</p>
                {capturedLocation && <p className="mt-2 leading-5">تم تثبيت هذه القراءة؛ تحرك جهازك لا يغيّر موقع النقطة. اسحب العلامة لتعديلها.</p>}
              </div>
              <label htmlFor="map-point-name-ar" className="mb-2 text-sm font-bold text-slate-600">الاسم بالعربية</label>
              <input 
                id="map-point-name-ar"
                type="text" 
                className="border border-slate-300 p-3 rounded-xl mb-4 focus:ring-2 focus:ring-sky-500 focus:outline-none" 
                value={nameAr} 
                onChange={(e) => setNameAr(e.target.value)} 
              />

              <label htmlFor="map-point-name-en" className="mb-2 text-sm font-bold text-slate-600">الاسم بالإنجليزية</label>
              <input 
                id="map-point-name-en"
                type="text" 
                className="border border-slate-300 p-3 rounded-xl mb-4 focus:ring-2 focus:ring-sky-500 focus:outline-none" 
                value={nameEn} 
                onChange={(e) => setNameEn(e.target.value)} 
              />

              <label htmlFor="map-point-type" className="mb-2 text-sm font-bold text-slate-600">نوع النقطة</label>
              <select 
                id="map-point-type"
                className="border border-slate-300 p-3 rounded-xl mb-6 focus:ring-2 focus:ring-sky-500 focus:outline-none" 
                value={pointType} 
                onChange={(e) => setPointType(e.target.value)}
              >
                <option value="entrance">بوابة</option>
                <option value="hall">قاعة</option>
                <option value="office">مكتب</option>
                <option value="intersection">تقاطع مسارات</option>
                <option value="stairs">سلم</option>
                <option value="elevator">مصعد</option>
              </select>

              <button 
                className="primary-action mt-auto shrink-0 disabled:cursor-wait disabled:opacity-50"
                onClick={handleSavePoint}
                disabled={saving}
              >
                <Save size={16} aria-hidden="true" />{saving ? 'جارٍ الحفظ…' : 'حفظ النقطة'}
              </button>
              
              <button 
                className="mt-3 text-red-500 font-bold py-3 rounded-xl hover:bg-red-50 transition-colors shrink-0"
                onClick={() => { setNewPointLocation(null); setCapturedLocation(null); }}
                disabled={saving}
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Sidebar: Add Route Form */}
        {mode === 'add_route' && (
          <div className="w-full md:w-96 bg-white border-t md:border-t-0 md:border-r border-slate-200 shadow-xl z-10 flex flex-col shrink-0 md:h-full">
            <div className="p-5 border-b border-slate-100 shrink-0 bg-slate-50">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800"><RouteIcon size={19} aria-hidden="true" />رسم مسار جديد</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">الخط والمسافة تقريبيان؛ تحقّق من الممر الفعلي قبل اعتماده.</p>
            </div>
            
            <div className="p-5 overflow-visible md:overflow-y-auto md:flex-1 flex flex-col">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 shrink-0">
                <div className="mb-3">
                  <span className="block text-xs font-bold text-slate-500 mb-1">نقطة البداية (أ):</span>
                  <span className={`font-semibold ${routeStart ? 'text-sky-700' : 'text-slate-400'}`}>
                    {routeStart ? routeStart.name_ar : 'انقر على نقطة بالخريطة'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-500 mb-1">نقطة النهاية (ب):</span>
                  <span className={`font-semibold ${routeEnd ? 'text-amber-600' : 'text-slate-400'}`}>
                    {routeEnd ? routeEnd.name_ar : 'انقر على النقطة الثانية'}
                  </span>
                </div>
              </div>

              {routeStart && routeEnd && (
                <>
                  <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-200 font-bold mb-6 text-sm text-center shrink-0">
                    المسافة المباشرة: {getDistance(routeStart.latitude!, routeStart.longitude!, routeEnd.latitude!, routeEnd.longitude!)} متر
                  </div>

                  <label htmlFor="map-route-name-ar" className="mb-2 text-sm font-bold text-slate-600">اسم المسار بالعربية (اختياري)</label>
                  <input 
                    id="map-route-name-ar"
                    type="text" 
                    className="border border-slate-300 p-3 rounded-xl mb-4 focus:ring-2 focus:ring-amber-500 focus:outline-none shrink-0" 
                    value={routeNameAr} 
                    onChange={(e) => setRouteNameAr(e.target.value)} 
                    placeholder={`مسار إلى ${routeEnd.name_ar}`}
                  />

                  <label htmlFor="map-route-type" className="mb-2 text-sm font-bold text-slate-600">نوع المسار</label>
                  <select 
                    id="map-route-type"
                    className="border border-slate-300 p-3 rounded-xl mb-4 focus:ring-2 focus:ring-amber-500 focus:outline-none shrink-0" 
                    value={routeType} 
                    onChange={(e) => setRouteType(e.target.value as RouteType)}
                  >
                    <option value="blind_friendly">مهيأ للمكفوفين (Blind Friendly)</option>
                    <option value="fastest">الأسرع (Fastest)</option>
                    <option value="safe_accessible">آمن وسهل الوصول</option>
                    <option value="wheelchair">مهيأ للكراسي المتحركة</option>
                  </select>

                  <div className="flex flex-col gap-3 mb-8 mt-2 shrink-0">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={hasStairs} onChange={(e) => setHasStairs(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
                      <span className="text-sm font-semibold text-slate-700">يحتوي على سلالم</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={hasRamp} onChange={(e) => setHasRamp(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
                      <span className="text-sm font-semibold text-slate-700">يحتوي على منحدر (Ramp)</span>
                    </label>
                  </div>

                  <button 
                    className="primary-action mt-auto shrink-0 disabled:cursor-wait disabled:opacity-50"
                    onClick={handleSaveRoute}
                    disabled={saving}
                  >
                    <Save size={16} aria-hidden="true" />{saving ? 'جارٍ الحفظ…' : 'حفظ المسار'}
                  </button>
                  
                  <button 
                    className="mt-3 text-slate-500 font-bold py-3.5 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
                    onClick={cancelRoute}
                    disabled={saving}
                  >
                    إلغاء التحديد
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
