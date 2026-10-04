'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { EmergencyRequest, EmergencyStatus } from '@baser/types';
import { supabase } from '@/lib/supabase';
import { saveRequestStatus } from '@/lib/request-status';

const labels: Record<EmergencyStatus, string> = {
  new: 'بانتظار الاستلام', contacted: 'تم تأكيد الاستلام', arrived: 'تم الوصول', resolved: 'تمت المعالجة', cancelled: 'ألغاه صاحب الطلب',
};
const closed = (request: EmergencyRequest) => ['resolved', 'cancelled'].includes(request.status);

export default function EmergencyPage() {
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState('جاري توصيل التحديثات المباشرة…');
  const [pending, setPending] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const writing = useRef(false);
  const mounted = useRef(true);
  const fetchVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++fetchVersion.current;
    try {
      const { data, error } = await supabase.from('emergency_requests').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (mounted.current && version === fetchVersion.current) { setRequests(data || []); setError(''); }
    } catch {
      if (mounted.current && version === fetchVersion.current) setError('تعذر تحميل حالة الطوارئ. البيانات المعروضة قديمة؛ تحقق من الاتصال والصلاحيات وأعد التحديث.');
    } finally { if (mounted.current) setLoading(false); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    // Refetch canonical rows for INSERT/UPDATE/DELETE instead of optimistic status.
    const channel = supabase.channel('emergency_operations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_requests' }, payload => {
        if (payload.eventType === 'INSERT' && audio.current?.state === 'running') {
          const context = audio.current;
          const oscillator = context.createOscillator();
          const volume = context.createGain();
          oscillator.connect(volume); volume.connect(context.destination);
          oscillator.frequency.value = 880;
          volume.gain.setValueAtTime(0.1, context.currentTime);
          volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.6);
          oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
          oscillator.start(); oscillator.stop(context.currentTime + 0.6);
        }
        void refresh();
      })
      .subscribe(status => {
        if (!mounted.current) return;
        setConnection(status === 'SUBSCRIBED' ? 'التحديثات المباشرة متصلة' : 'التحديث المباشر غير مؤكد؛ نعيد جلب البيانات كل 30 ثانية');
      });
    const poll = setInterval(refresh, 30000);
    return () => {
      mounted.current = false; fetchVersion.current++; clearInterval(poll); void supabase.removeChannel(channel);
      if (audio.current) void audio.current.close();
      audio.current = null;
    };
  }, [refresh]);

  const enableSound = async () => {
    try {
      // A user gesture is required by browser audio policies.
      const context = audio.current ?? new AudioContext();
      audio.current = context;
      context.onstatechange = () => { if (mounted.current) setSoundEnabled(context.state === 'running'); };
      await context.resume();
      if (context.state !== 'running') throw new Error('Audio unavailable');
      setSoundEnabled(true);
    } catch { setError('تعذر تفعيل التنبيه الصوتي. تابع الشاشة والتحديثات المباشرة.'); }
  };

  const changeStatus = async (request: EmergencyRequest, status: EmergencyStatus) => {
    if (writing.current) return;
    writing.current = true; setPending(request.id); setError('');
    try {
      await saveRequestStatus(supabase, 'emergency_requests', request.id, request.status, status);
      await refresh();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'تعذر تأكيد التحديث.');
    } finally { writing.current = false; if (mounted.current) setPending(null); }
  };
  const active = requests.filter(request => !closed(request));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-2xl font-black text-slate-950">غرفة استجابة الطوارئ</h2><p className="mt-2 text-sm text-slate-600">{connection}</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={enableSound} className="secondary-action" disabled={soundEnabled}>{soundEnabled ? 'التنبيه الصوتي مفعّل' : 'تفعيل تنبيه الطلبات الجديدة'}</button>
          <button onClick={refresh} className="secondary-action">تحديث البيانات</button>
        </div>
      </div>
      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p> : null}
      {loading ? <p role="status">جاري تحميل الطلبات…</p> : !error && active.length === 0 ? <p className="surface-panel">لا توجد طلبات طوارئ مفتوحة في البيانات المحملة.</p> : null}
      {active.map(request => (
        <article key={request.id} className="surface-panel space-y-5 border-red-200">
          <div className="flex flex-wrap justify-between gap-3"><strong className="text-red-800">{labels[request.status]}</strong><time className="text-sm text-slate-600">{new Date(request.created_at).toLocaleString('ar-SA')}</time></div>
          <p className="break-all text-sm text-slate-600">رقم الطلب: {request.id}</p>
          <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-slate-950">{request.message || 'لم يُرسل وصف إضافي.'}</p>
          {request.latitude != null && request.longitude != null ? (
            <div className="space-y-2"><p>الإحداثيات وقت الإرسال: <span dir="ltr">{request.latitude.toFixed(5)}, {request.longitude.toFixed(5)}</span></p><p className="text-sm text-slate-600">الموقع لا يتحدث تلقائيًا. تحقق من وصف المكان قبل التوجه.</p></div>
          ) : <p className="rounded-xl bg-amber-50 p-4 text-amber-900">الموقع الجغرافي غير متاح. لا توجد إحداثيات مؤكدة لهذا الطلب؛ اعتمد على وصف المكان وآلية الاستجابة المعتمدة في الموقع.</p>}
          <div className="flex flex-wrap gap-3">
            {request.status === 'new' ? <button disabled={pending !== null} className="primary-action disabled:opacity-50" onClick={() => changeStatus(request, 'contacted')}>تأكيد استلام الطلب</button> : null}
            {request.status === 'contacted' ? <button disabled={pending !== null} className="primary-action disabled:opacity-50" onClick={() => changeStatus(request, 'arrived')}>تسجيل الوصول إلى المستخدم</button> : null}
            <button disabled={pending !== null} className="secondary-action disabled:opacity-50" onClick={() => changeStatus(request, 'resolved')}>إغلاق الطلب بعد المعالجة</button>
            {pending === request.id ? <span role="status">جاري تأكيد الحفظ…</span> : null}
          </div>
        </article>
      ))}
      {requests.some(closed) ? <section className="surface-panel"><h3 className="mb-4 font-bold">الطلبات المغلقة</h3><ul className="space-y-3">{requests.filter(closed).map(request => <li key={request.id} className="break-all text-sm">{request.id} — {labels[request.status]}</li>)}</ul></section> : null}
    </div>
  );
}
