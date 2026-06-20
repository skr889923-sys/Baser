'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DirectionType,
  HapticPatternType,
  NavigationPoint,
  Route,
  RouteStep,
  RouteStatus,
  RouteType,
} from '@baser/types';

type RouteForm = {
  start_point_id: string;
  end_point_id: string;
  name_ar: string;
  name_en: string;
  route_type: RouteType;
  distance_meters: string;
  estimated_minutes: string;
  direction: DirectionType;
  haptic_pattern: HapticPatternType;
  instruction_ar: string;
  instruction_en: string;
  has_stairs: boolean;
  has_ramp: boolean;
  wheelchair_accessible: boolean;
  visually_impaired_friendly: boolean;
};

const EMPTY_FORM: RouteForm = {
  start_point_id: '',
  end_point_id: '',
  name_ar: '',
  name_en: '',
  route_type: 'safe_accessible',
  distance_meters: '',
  estimated_minutes: '',
  direction: 'straight',
  haptic_pattern: 'continue',
  instruction_ar: '',
  instruction_en: '',
  has_stairs: false,
  has_ramp: false,
  wheelchair_accessible: true,
  visually_impaired_friendly: true,
};

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadius = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const routeTypeLabel: Record<RouteType, string> = {
  fastest: 'الأسرع',
  safe_accessible: 'آمن ومهيأ',
  wheelchair: 'كرسي متحرك',
  blind_friendly: 'مهيأ للمكفوفين',
};

const statusLabel: Record<RouteStatus, string> = {
  active: 'نشط',
  closed: 'مغلق',
  maintenance: 'صيانة',
};

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [points, setPoints] = useState<NavigationPoint[]>([]);
  const [stepsByRoute, setStepsByRoute] = useState<Record<string, RouteStep[]>>({});
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<RouteForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const pointsById = useMemo(() => {
    return Object.fromEntries(points.map(point => [point.id, point]));
  }, [points]);

  const selectedRouteSteps = selectedRouteId ? stepsByRoute[selectedRouteId] || [] : [];

  const fetchData = async () => {
    setLoading(true);

    const [{ data: pointsData }, { data: routesData }, { data: stepsData }] = await Promise.all([
      supabase.from('navigation_points').select('*').eq('is_active', true).order('name_ar', { ascending: true }),
      supabase.from('routes').select('*').order('created_at', { ascending: false }),
      supabase.from('route_steps').select('*').order('step_order', { ascending: true }),
    ]);

    const loadedRoutes = (routesData || []) as Route[];
    setPoints((pointsData || []) as NavigationPoint[]);
    setRoutes(loadedRoutes);

    const groupedSteps = ((stepsData || []) as RouteStep[]).reduce<Record<string, RouteStep[]>>((acc, step) => {
      acc[step.route_id] = [...(acc[step.route_id] || []), step];
      return acc;
    }, {});
    setStepsByRoute(groupedSteps);

    if (!selectedRouteId && loadedRoutes.length > 0) {
      setSelectedRouteId(loadedRoutes[0].id);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getPointName = (id: string) => pointsById[id]?.name_ar || 'نقطة غير معروفة';

  const buildRouteDistance = () => {
    if (form.distance_meters) return Math.round(Number(form.distance_meters));

    const start = pointsById[form.start_point_id];
    const end = pointsById[form.end_point_id];
    if (start?.latitude && start.longitude && end?.latitude && end.longitude) {
      return getDistance(start.latitude, start.longitude, end.latitude, end.longitude);
    }

    return 1;
  };

  const handleAddRoute = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.start_point_id || !form.end_point_id || form.start_point_id === form.end_point_id) {
      alert('يرجى اختيار نقطتي بداية ونهاية مختلفتين.');
      return;
    }

    setSaving(true);

    const start = pointsById[form.start_point_id];
    const end = pointsById[form.end_point_id];
    const distance = buildRouteDistance();
    const estimatedMinutes = form.estimated_minutes
      ? Number(form.estimated_minutes)
      : Math.max(1, Math.round(distance / 84));

    const routePayload = {
      start_point_id: form.start_point_id,
      end_point_id: form.end_point_id,
      name_ar: form.name_ar || `من ${start?.name_ar || 'نقطة البداية'} إلى ${end?.name_ar || 'نقطة النهاية'}`,
      name_en: form.name_en || `From ${start?.name_en || 'start'} to ${end?.name_en || 'destination'}`,
      route_type: form.route_type,
      distance_meters: distance,
      estimated_minutes: estimatedMinutes,
      has_stairs: form.has_stairs,
      has_ramp: form.has_ramp,
      wheelchair_accessible: form.wheelchair_accessible,
      visually_impaired_friendly: form.visually_impaired_friendly,
      status: 'active' as RouteStatus,
    };

    const { data: routeData, error: routeError } = await supabase
      .from('routes')
      .insert([routePayload])
      .select()
      .single();

    if (routeError || !routeData) {
      console.error(routeError);
      alert('تعذر حفظ المسار.');
      setSaving(false);
      return;
    }

    const stepPayload = {
      route_id: routeData.id,
      step_order: 1,
      from_point_id: form.start_point_id,
      to_point_id: form.end_point_id,
      instruction_ar: form.instruction_ar || `توجه من ${start?.name_ar || 'نقطة البداية'} إلى ${end?.name_ar || 'نقطة النهاية'} لمسافة ${distance} متر.`,
      instruction_en: form.instruction_en || `Proceed from ${start?.name_en || 'start'} to ${end?.name_en || 'destination'} for ${distance} meters.`,
      distance_meters: distance,
      direction: form.direction,
      haptic_pattern: form.haptic_pattern,
      warning_level: form.has_stairs ? 'caution' : 'none',
    };

    const { error: stepError } = await supabase.from('route_steps').insert([stepPayload]);
    if (stepError) {
      console.error(stepError);
      alert('تم حفظ المسار، لكن تعذر حفظ الخطوة الأولى.');
    }

    setForm(EMPTY_FORM);
    setShowAddForm(false);
    setSelectedRouteId(routeData.id);
    await fetchData();
    setSaving(false);
  };

  const updateRouteStatus = async (id: string, status: RouteStatus) => {
    const { error } = await supabase.from('routes').update({ status }).eq('id', id);
    if (!error) {
      setRoutes(routes.map(route => route.id === id ? { ...route, status } : route));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-800">إدارة المسارات الملاحية</h3>
          <p className="text-sm text-slate-500 mt-1">ربط نقاط الخريطة بمسارات قابلة للاستخدام مباشرة في تطبيق الجوال.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full sm:w-auto bg-sky-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-sky-700 transition-colors shadow-sm text-sm"
        >
          {showAddForm ? 'إلغاء الإضافة' : 'إضافة مسار جديد'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddRoute} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">نقطة البداية</label>
            <select
              required
              value={form.start_point_id}
              onChange={e => setForm({ ...form, start_point_id: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500"
            >
              <option value="">اختر نقطة...</option>
              {points.map(point => <option key={point.id} value={point.id}>{point.name_ar}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">نقطة النهاية</label>
            <select
              required
              value={form.end_point_id}
              onChange={e => setForm({ ...form, end_point_id: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500"
            >
              <option value="">اختر نقطة...</option>
              {points.map(point => <option key={point.id} value={point.id}>{point.name_ar}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">نوع المسار</label>
            <select
              value={form.route_type}
              onChange={e => setForm({ ...form, route_type: e.target.value as RouteType })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500"
            >
              <option value="safe_accessible">آمن ومهيأ</option>
              <option value="blind_friendly">مهيأ للمكفوفين</option>
              <option value="wheelchair">كرسي متحرك</option>
              <option value="fastest">الأسرع</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">الاتجاه</label>
            <select
              value={form.direction}
              onChange={e => setForm({ ...form, direction: e.target.value as DirectionType })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500"
            >
              <option value="straight">للأمام</option>
              <option value="left">يسار</option>
              <option value="right">يمين</option>
              <option value="slight_left">يسار بسيط</option>
              <option value="slight_right">يمين بسيط</option>
              <option value="elevator_up">مصعد للأعلى</option>
              <option value="elevator_down">مصعد للأسفل</option>
              <option value="stairs_up">درج للأعلى</option>
              <option value="stairs_down">درج للأسفل</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم المسار بالعربية</label>
            <input
              value={form.name_ar}
              onChange={e => setForm({ ...form, name_ar: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500"
              placeholder="اختياري"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم المسار بالإنجليزية</label>
            <input
              value={form.name_en}
              onChange={e => setForm({ ...form, name_en: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">المسافة بالمتر</label>
            <input
              type="number"
              min="1"
              value={form.distance_meters}
              onChange={e => setForm({ ...form, distance_meters: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500"
              placeholder="تحسب تلقائياً"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">الزمن بالدقائق</label>
            <input
              type="number"
              min="1"
              step="0.5"
              value={form.estimated_minutes}
              onChange={e => setForm({ ...form, estimated_minutes: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500"
              placeholder="يحسب تلقائياً"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1.5">تعليمات الخطوة بالعربية</label>
            <textarea
              value={form.instruction_ar}
              onChange={e => setForm({ ...form, instruction_ar: e.target.value })}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500"
              placeholder="اتركها فارغة لتوليد نص تلقائي"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1.5">تعليمات الخطوة بالإنجليزية</label>
            <textarea
              value={form.instruction_en}
              onChange={e => setForm({ ...form, instruction_en: e.target.value })}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500"
              placeholder="Leave blank to auto-generate"
            />
          </div>

          <div className="lg:col-span-3 flex flex-wrap gap-4 items-center text-sm font-semibold text-slate-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.has_stairs} onChange={e => setForm({ ...form, has_stairs: e.target.checked })} />
              يحتوي على سلالم
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.has_ramp} onChange={e => setForm({ ...form, has_ramp: e.target.checked })} />
              يحتوي على منحدر
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.wheelchair_accessible} onChange={e => setForm({ ...form, wheelchair_accessible: e.target.checked })} />
              مناسب للكراسي المتحركة
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.visually_impaired_friendly} onChange={e => setForm({ ...form, visually_impaired_friendly: e.target.checked })} />
              مناسب للمكفوفين
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ المسار'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="md:hidden divide-y divide-slate-100">
              {loading ? (
                <div className="p-6 text-center text-sm text-slate-500">جاري التحميل...</div>
              ) : routes.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">لا توجد مسارات محفوظة بعد.</div>
              ) : routes.map(route => (
                <div
                  key={route.id}
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedRouteId === route.id ? 'bg-sky-50/70 border-r-4 border-sky-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-800 truncate">{route.name_ar}</h4>
                      <p className="text-xs text-slate-400 font-semibold mt-1 truncate">{route.name_en}</p>
                    </div>
                    <span className="shrink-0 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">
                      {routeTypeLabel[route.route_type]}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs font-bold text-slate-500 mb-1">النقاط</div>
                      <div className="font-semibold text-slate-700 truncate">{getPointName(route.start_point_id)}</div>
                      <div className="text-xs text-slate-500 mt-1 truncate">إلى: {getPointName(route.end_point_id)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs font-bold text-slate-500 mb-1">المسافة</div>
                        <div className="font-bold text-slate-800">{route.distance_meters} م</div>
                        <div className="text-xs text-slate-500 mt-1">{route.estimated_minutes} دقيقة</div>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <label className="text-xs font-bold text-slate-500 block mb-1">الحالة</label>
                        <select
                          value={route.status}
                          onClick={event => event.stopPropagation()}
                          onChange={event => updateRouteStatus(route.id, event.target.value as RouteStatus)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold"
                        >
                          <option value="active">{statusLabel.active}</option>
                          <option value="maintenance">{statusLabel.maintenance}</option>
                          <option value="closed">{statusLabel.closed}</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="p-4">اسم المسار</th>
                    <th className="p-4">النقاط</th>
                    <th className="p-4">التصنيف</th>
                    <th className="p-4">المسافة</th>
                    <th className="p-4">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500">جاري التحميل...</td></tr>
                ) : routes.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500">لا توجد مسارات محفوظة بعد.</td></tr>
                ) : routes.map(route => (
                  <tr
                    key={route.id}
                    onClick={() => setSelectedRouteId(route.id)}
                    className={`cursor-pointer hover:bg-slate-50/50 transition-colors ${selectedRouteId === route.id ? 'bg-sky-50/60 border-r-4 border-sky-600' : ''}`}
                  >
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{route.name_ar}</div>
                      <div className="text-xs text-slate-400 font-semibold mt-1">{route.name_en}</div>
                    </td>
                    <td className="p-4 text-slate-600">
                      <div>{getPointName(route.start_point_id)}</div>
                      <div className="text-xs text-slate-400 mt-1">إلى: {getPointName(route.end_point_id)}</div>
                    </td>
                    <td className="p-4">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">
                        {routeTypeLabel[route.route_type]}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">
                      <div>{route.distance_meters} م</div>
                      <div className="text-xs text-slate-400 mt-1">{route.estimated_minutes} دقيقة</div>
                    </td>
                    <td className="p-4">
                      <select
                        value={route.status}
                        onClick={event => event.stopPropagation()}
                        onChange={event => updateRouteStatus(route.id, event.target.value as RouteStatus)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold"
                      >
                        <option value="active">{statusLabel.active}</option>
                        <option value="maintenance">{statusLabel.maintenance}</option>
                        <option value="closed">{statusLabel.closed}</option>
                      </select>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
          <h4 className="text-base font-bold text-slate-800 mb-6">الخطوات التفصيلية</h4>
          {selectedRouteSteps.length > 0 ? (
            <div className="space-y-4">
              {selectedRouteSteps.map(step => (
                <div key={step.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-8 h-8 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center">
                      {step.step_order}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">{step.direction} / {step.haptic_pattern}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 leading-6">{step.instruction_ar}</p>
                  <p className="text-xs text-slate-500 mt-2">{step.distance_meters} متر</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
              اختر مساراً لعرض خطواته، أو أضف مساراً جديداً.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
