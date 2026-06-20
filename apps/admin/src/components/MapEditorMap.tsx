"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../lib/supabase';
import type { NavigationPoint, Route } from '@baser/types';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const SUEZ_CANAL_UNIV_CENTER: [number, number] = [30.622971, 32.269073];

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

type EditorMode = 'add_point' | 'add_route';

export default function MapEditorMap() {
  const [points, setPoints] = useState<NavigationPoint[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [mode, setMode] = useState<EditorMode>('add_point');

  // Point Form State
  const [newPointLocation, setNewPointLocation] = useState<[number, number] | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [pointType, setPointType] = useState<string>('entrance');

  // Route Form State
  const [routeStart, setRouteStart] = useState<NavigationPoint | null>(null);
  const [routeEnd, setRouteEnd] = useState<NavigationPoint | null>(null);
  const [routeNameAr, setRouteNameAr] = useState('');
  const [routeNameEn, setRouteNameEn] = useState('');
  const [routeType, setRouteType] = useState<string>('blind_friendly');
  const [hasStairs, setHasStairs] = useState(false);
  const [hasRamp, setHasRamp] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: pData } = await supabase.from('navigation_points').select('*');
    if (pData) setPoints(pData);

    const { data: rData } = await supabase.from('routes').select('*');
    if (rData) setRoutes(rData);

    setLoading(false);
  };

  const handleMapClick = (e: L.LeafletMouseEvent) => {
    if (mode === 'add_point') {
      setNewPointLocation([e.latlng.lat, e.latlng.lng]);
      setNameAr('');
      setNameEn('');
      setPointType('entrance');
    }
  };

  const handleMarkerClick = (pt: NavigationPoint) => {
    if (mode === 'add_route') {
      if (!routeStart) {
        setRouteStart(pt);
      } else if (!routeEnd && pt.id !== routeStart.id) {
        setRouteEnd(pt);
      }
    }
  };

  const handleSavePoint = async () => {
    if (!newPointLocation) return;
    const { error } = await supabase.from('navigation_points').insert([{
      name_ar: nameAr || 'نقطة جديدة',
      name_en: nameEn || 'New Point',
      type: pointType,
      latitude: newPointLocation[0],
      longitude: newPointLocation[1],
      description_ar: 'تم إنشاؤه عبر لوحة التحكم',
      description_en: 'Created via admin panel',
      audio_instruction_ar: '',
      audio_instruction_en: '',
      is_accessible: true,
      is_hazard: false,
      is_active: true
    }]);

    if (error) alert('Error: ' + error.message);
    else {
      alert('تم حفظ النقطة بنجاح!');
      setNewPointLocation(null);
      fetchData();
    }
  };

  const handleSaveRoute = async () => {
    if (!routeStart || !routeEnd) return;
    
    const distance = getDistance(
      routeStart.latitude!, routeStart.longitude!, 
      routeEnd.latitude!, routeEnd.longitude!
    );
    // rough estimation: avg walking speed 1.4 m/s -> 84 m / min
    const estimatedMinutes = Math.max(1, Math.round(distance / 84));

    // 1. Save Route
    const { data: routeData, error: routeError } = await supabase.from('routes').insert([{
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
    }]).select().single();

    if (routeError) {
      alert('Error saving route: ' + routeError.message);
      return;
    }

    // 2. Save Auto-generated Route Step
    const { error: stepError } = await supabase.from('route_steps').insert([{
      route_id: routeData.id,
      step_order: 1,
      from_point_id: routeStart.id,
      to_point_id: routeEnd.id,
      instruction_ar: `توجة من ${routeStart.name_ar} إلى ${routeEnd.name_ar} لمسافة ${distance} متر.`,
      instruction_en: `Proceed from ${routeStart.name_en} to ${routeEnd.name_en} for ${distance} meters.`,
      distance_meters: distance,
      haptic_pattern: 'none'
    }]);

    if (stepError) {
      alert('Error saving route step: ' + stepError.message);
    } else {
      alert('تم حفظ المسار بنجاح!');
      setRouteStart(null);
      setRouteEnd(null);
      setRouteNameAr('');
      setRouteNameEn('');
      fetchData();
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
    if (start && end && start.latitude && start.longitude && end.latitude && end.longitude) {
      return [
        [start.latitude, start.longitude],
        [end.latitude, end.longitude]
      ];
    }
    return [];
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      {/* Top Bar for Mode Switching */}
      <div className="bg-white p-3 border-b flex justify-center gap-4 z-[1000] shadow-sm">
        <button 
          onClick={() => { setMode('add_point'); cancelRoute(); setNewPointLocation(null); }}
          className={`px-6 py-2 rounded-xl font-bold text-sm transition-colors ${mode === 'add_point' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          📍 وضع إضافة النقاط
        </button>
        <button 
          onClick={() => { setMode('add_route'); cancelRoute(); setNewPointLocation(null); }}
          className={`px-6 py-2 rounded-xl font-bold text-sm transition-colors ${mode === 'add_route' ? 'bg-amber-500 text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          🛣️ وضع رسم المسارات
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        {/* Map Area */}
        <div className="flex-1 min-h-[50vh] relative z-0">
          <MapContainer center={SUEZ_CANAL_UNIV_CENTER} zoom={18} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapEvents onMapClick={handleMapClick} />
            
            {/* Existing Points */}
            {points.map((pt) => (
              <Marker 
                key={pt.id} 
                position={[pt.latitude || 0, pt.longitude || 0]}
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
            {routes.map((rt) => {
              const coords = getRouteCoordinates(rt);
              if (coords.length > 0) {
                return <Polyline key={rt.id} positions={coords} color="#3B82F6" weight={5} opacity={0.7} />;
              }
              return null;
            })}

            {/* Temporary New Point Marker */}
            {mode === 'add_point' && newPointLocation && (
              <Marker position={newPointLocation}>
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
              />
            )}
            
            {/* Highlight Selected Start Point */}
            {mode === 'add_route' && routeStart && (
              <Marker position={[routeStart.latitude!, routeStart.longitude!]} opacity={0.8}>
                <Popup>نقطة البداية المحددة</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Sidebar: Add Point Form */}
        {mode === 'add_point' && newPointLocation && (
          <div className="w-full md:w-96 bg-white border-t md:border-t-0 md:border-r border-slate-200 shadow-xl z-10 flex flex-col shrink-0">
            <div className="p-5 border-b border-slate-100 shrink-0 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">📍 إضافة نقطة جديدة</h2>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 flex flex-col">
              <label className="mb-2 text-sm font-bold text-slate-600">الاسم بالعربية</label>
              <input 
                type="text" 
                className="border border-slate-300 p-3 rounded-xl mb-4 focus:ring-2 focus:ring-sky-500 focus:outline-none" 
                value={nameAr} 
                onChange={(e) => setNameAr(e.target.value)} 
              />

              <label className="mb-2 text-sm font-bold text-slate-600">الاسم بالإنجليزية</label>
              <input 
                type="text" 
                className="border border-slate-300 p-3 rounded-xl mb-4 focus:ring-2 focus:ring-sky-500 focus:outline-none" 
                value={nameEn} 
                onChange={(e) => setNameEn(e.target.value)} 
              />

              <label className="mb-2 text-sm font-bold text-slate-600">نوع النقطة</label>
              <select 
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
                className="bg-sky-600 text-white font-bold py-3.5 rounded-xl hover:bg-sky-700 transition-colors shadow-md mt-auto shrink-0"
                onClick={handleSavePoint}
              >
                💾 حفظ النقطة
              </button>
              
              <button 
                className="mt-3 text-red-500 font-bold py-3 rounded-xl hover:bg-red-50 transition-colors shrink-0"
                onClick={() => setNewPointLocation(null)}
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Sidebar: Add Route Form */}
        {mode === 'add_route' && (
          <div className="w-full md:w-96 bg-white border-t md:border-t-0 md:border-r border-slate-200 shadow-xl z-10 flex flex-col shrink-0">
            <div className="p-5 border-b border-slate-100 shrink-0 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">🛣️ رسم مسار جديد</h2>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 flex flex-col">
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
                    المسافة: {getDistance(routeStart.latitude!, routeStart.longitude!, routeEnd.latitude!, routeEnd.longitude!)} متر
                  </div>

                  <label className="mb-2 text-sm font-bold text-slate-600">اسم المسار بالعربية (اختياري)</label>
                  <input 
                    type="text" 
                    className="border border-slate-300 p-3 rounded-xl mb-4 focus:ring-2 focus:ring-amber-500 focus:outline-none shrink-0" 
                    value={routeNameAr} 
                    onChange={(e) => setRouteNameAr(e.target.value)} 
                    placeholder={`مسار إلى ${routeEnd.name_ar}`}
                  />

                  <label className="mb-2 text-sm font-bold text-slate-600">نوع المسار</label>
                  <select 
                    className="border border-slate-300 p-3 rounded-xl mb-4 focus:ring-2 focus:ring-amber-500 focus:outline-none shrink-0" 
                    value={routeType} 
                    onChange={(e) => setRouteType(e.target.value)}
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
                    className="bg-amber-500 text-slate-900 font-bold py-3.5 rounded-xl hover:bg-amber-600 transition-colors shadow-md mt-auto shrink-0"
                    onClick={handleSaveRoute}
                  >
                    🚀 حفظ المسار
                  </button>
                  
                  <button 
                    className="mt-3 text-slate-500 font-bold py-3.5 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
                    onClick={cancelRoute}
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
