'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface EmergencyRequest {
  id: string;
  user_id?: string | null;
  latitude: number | null;
  longitude: number | null;
  nearest_point_id?: string | null;
  nearest_building_id?: string | null;
  message?: string;
  status: 'new' | 'contacted' | 'arrived' | 'resolved';
  created_at: string;
}

export default function EmergencyPage() {
  const [emergencies, setEmergencies] = useState<EmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial emergencies and setup realtime
  useEffect(() => {
    const fetchEmergencies = async () => {
      const { data, error } = await supabase
        .from('emergency_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching emergencies:', error);
      } else {
        setEmergencies(data as EmergencyRequest[]);
      }
      setLoading(false);
    };

    fetchEmergencies();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('emergency_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_requests'
        },
        (payload) => {
          console.log('Realtime payload:', payload);
          if (payload.eventType === 'INSERT') {
            setEmergencies(prev => [payload.new as EmergencyRequest, ...prev]);
            // Play alert sound if new emergency using Web Audio API to avoid 404 on missing mp3
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.type = 'sine';
              oscillator.frequency.value = 880; // A5 pitch
              gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
              oscillator.start(audioCtx.currentTime);
              oscillator.stop(audioCtx.currentTime + 0.5);
            } catch (e) {
              console.log('Audio beep failed:', e);
            }
          } else if (payload.eventType === 'UPDATE') {
            setEmergencies(prev => prev.map(e => e.id === payload.new.id ? payload.new as EmergencyRequest : e));
          } else if (payload.eventType === 'DELETE') {
            setEmergencies(prev => prev.filter(e => e.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDispatch = async (id: string) => {
    // Optimistic update
    setEmergencies(emergencies.map(e => e.id === id ? { ...e, status: 'contacted' } : e));
    
    const { error } = await supabase
      .from('emergency_requests')
      .update({ status: 'contacted' })
      .eq('id', id);
      
    if (error) console.error('Error updating status to contacted:', error);
  };

  const handleResolve = async (id: string) => {
    // Optimistic update
    setEmergencies(emergencies.map(e => e.id === id ? { ...e, status: 'resolved' } : e));

    const { error } = await supabase
      .from('emergency_requests')
      .update({ status: 'resolved' })
      .eq('id', id);
      
    if (error) console.error('Error updating status to resolved:', error);
  };

  if (loading) {
    return <div className="text-center py-20">جاري تحميل البلاغات...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-red-600 flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-red-600 block animate-pulse"></span>
            غرفة مراقبة طوارئ SOS
          </h3>
          <p className="text-sm text-slate-500 mt-1">تتبع إشارات استغاثة الطلاب والمكفوفين، وتحديد موقعهم على الخريطة لإرسال المساعدة فورًا.</p>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 gap-6">
        {emergencies.filter(e => e.status !== 'resolved').length > 0 ? (
          emergencies.filter(e => e.status !== 'resolved').map(sos => (
            <div key={sos.id} className="bg-white rounded-2xl shadow-sm border-2 border-red-200 overflow-hidden flex flex-col lg:flex-row">
              {/* Emergency info card (left) */}
              <div className="p-6 flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="bg-red-600 text-white text-xs px-2.5 py-1 rounded-full font-bold animate-pulse-red">
                      نداء استغاثة نشط
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">{new Date(sos.created_at).toLocaleTimeString('ar-SA')}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400" title={sos.id}>ID: {sos.id.substring(0,8)}...</span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-slate-800">معرف المستخدم: {sos.user_id || 'مجهول (زائر)'}</h4>
                  <p className="text-sm text-red-800 bg-red-50/50 p-4 rounded-xl border border-red-100 font-medium leading-6">
                    💬 الرسالة: {sos.message || 'لا توجد رسالة'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-2">
                    <span>📍 أقرب نقطة ملاحية:</span>
                    <span className="text-slate-800 font-bold">{sos.nearest_point_id || 'غير محدد'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🌐 إحداثيات المشاة GPS:</span>
                    <span className="text-slate-800 font-mono font-bold">{sos.latitude?.toFixed(5) || '-'} , {sos.longitude?.toFixed(5) || '-'}</span>
                  </div>
                </div>

                {/* Operations triggers */}
                <div className="border-t border-slate-100 pt-4 flex gap-3">
                  {sos.status === 'new' ? (
                    <button 
                      onClick={() => handleDispatch(sos.id)}
                      className="bg-red-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-red-700 transition-colors"
                    >
                      🚒 إرسال فريق الأمن الجامعي
                    </button>
                  ) : (
                    <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-4 py-2.5 rounded-xl">
                      ✓ الدورية في طريقها للموقع
                    </span>
                  )}
                  <button 
                    onClick={() => handleResolve(sos.id)}
                    className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-emerald-700 transition-colors"
                  >
                    ✓ تم الوصول وإغلاق البلاغ
                  </button>
                </div>
              </div>

              {/* Map Preview simulation (right) */}
              <div className="w-full lg:w-96 bg-slate-900 flex items-center justify-center p-6 shrink-0 relative min-h-[220px]">
                <div className="absolute inset-0 bg-slate-950 opacity-20 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"></div>
                <div className="z-10 text-center space-y-3">
                  <span className="text-5xl block animate-bounce">📍</span>
                  <div className="bg-slate-800 text-white border border-slate-700 px-4 py-2 rounded-xl text-xs font-bold shadow-md">
                    موقع الطالب الجغرافي النشط
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">{sos.latitude?.toFixed(5)} , {sos.longitude?.toFixed(5)}</div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-3">
            <span className="text-5xl">🛡️</span>
            <h4 className="text-lg font-bold text-slate-800">الحرم الجامعي آمن بالكامل</h4>
            <p className="text-sm text-slate-400">لا توجد طلبات طوارئ SOS نشطة في الوقت الحالي.</p>
          </div>
        )}
      </div>
    </div>
  );
}
