'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// Define static phrases
const STATIC_PHRASES = [
  { key: 'voice_enabled', label: 'تم تفعيل الصوت', text: 'تم تفعيل الصوت' },
  { key: 'voice_muted', label: 'تم كتم الصوت', text: 'تم كتم الصوت' },
  { key: 'no_previous_instructions', label: 'لا توجد تعليمات سابقة', text: 'لا توجد تعليمات سابقة لتكرارها' },
  { key: 'near_point_prefix', label: 'أنت الآن بالقرب من (مقدمة النقطة)', text: 'أنت الآن بالقرب من' },
  { key: 'destination_reached', label: 'لقد وصلت إلى وجهتك', text: 'لقد وصلت إلى وجهتك' },
  { key: 'route_selected', label: 'تم اختيار مسار', text: 'تم اختيار مسار' },
  { key: 'route_distance', label: 'المسافة الكلية', text: 'المسافة الكلية' },
  { key: 'meters', label: 'متر', text: 'مترًا' },
  { key: 'route_time', label: 'الزمن المتوقع', text: 'الزمن المتوقع للوصول' },
  { key: 'minutes', label: 'دقيقة', text: 'دقيقة' },
];

export default function VoicesPage() {
  const [characters, setCharacters] = useState<any[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [activeCharId, setActiveCharId] = useState<string | null>(null);
  
  const [newCharName, setNewCharName] = useState('');
  const [newCharGender, setNewCharGender] = useState('female');

  // Recording states
  const [isRecording, setIsRecording] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeCharId) {
      fetchRecordings(activeCharId);
    }
  }, [activeCharId]);

  const fetchData = async () => {
    const { data: chars } = await supabase.from('voice_characters').select('*').order('created_at', { ascending: true });
    if (chars) {
      setCharacters(chars);
      if (chars.length > 0 && !activeCharId) setActiveCharId(chars[0].id);
    }

    const { data: pts } = await supabase.from('points').select('id, name').order('name', { ascending: true });
    if (pts) setPoints(pts);
  };

  const fetchRecordings = async (charId: string) => {
    const { data } = await supabase.from('voice_recordings').select('*').eq('character_id', charId);
    if (data) setRecordings(data);
  };

  const handleAddCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharName) return;
    const { data, error } = await supabase.from('voice_characters').insert([{
      name: newCharName,
      gender: newCharGender,
    }]).select();
    
    if (data && data[0]) {
      setCharacters([...characters, data[0]]);
      setActiveCharId(data[0].id);
      setNewCharName('');
    }
  };

  const startRecording = async (phraseKey: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadRecording(phraseKey, audioBlob);
        stream.getTracks().forEach(track => track.stop()); // Stop mic
      };

      mediaRecorder.start();
      setIsRecording(phraseKey);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('تعذر الوصول للمايكروفون. يرجى التأكد من إعطاء الصلاحيات للمتصفح.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(null);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const uploadRecording = async (phraseKey: string, audioBlob: Blob) => {
    if (!activeCharId) return;
    
    const fileName = `${activeCharId}/${phraseKey}-${Date.now()}.webm`;
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('voiceovers')
      .upload(fileName, audioBlob, { contentType: 'audio/webm' });

    if (uploadError) {
      console.error('Upload Error:', uploadError);
      alert('حدث خطأ أثناء رفع التسجيل');
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('voiceovers').getPublicUrl(fileName);
    const audioUrl = publicUrlData.publicUrl;

    // Check if recording already exists to update it
    const existing = recordings.find(r => r.phrase_key === phraseKey);
    
    if (existing) {
      const { error: dbError } = await supabase.from('voice_recordings')
        .update({ audio_url: audioUrl })
        .eq('id', existing.id);
      if (!dbError) fetchRecordings(activeCharId);
    } else {
      const { error: dbError } = await supabase.from('voice_recordings')
        .insert([{
          character_id: activeCharId,
          phrase_key: phraseKey,
          audio_url: audioUrl
        }]);
      if (!dbError) fetchRecordings(activeCharId);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const hasRecording = (phraseKey: string) => recordings.find(r => r.phrase_key === phraseKey);

  const renderPhraseItem = (key: string, label: string, hintText: string) => {
    const recording = hasRecording(key);
    const isThisRecording = isRecording === key;

    return (
      <div key={key} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-sky-200 transition-colors">
        <div className="flex-1 pr-4">
          <h4 className="font-bold text-slate-800">{label}</h4>
          <p className="text-sm text-slate-500 mt-1">يُقرأ: "{hintText}"</p>
        </div>
        
        <div className="flex items-center gap-4">
          {recording && !isThisRecording && (
            <audio src={recording.audio_url} controls className="h-8 w-48" />
          )}
          
          {isThisRecording ? (
            <button 
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200 animate-pulse"
            >
              <span>⏹️</span> إيقاف ({formatTime(recordingTime)})
            </button>
          ) : (
            <button 
              onClick={() => startRecording(key)}
              disabled={!!isRecording}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${
                isRecording ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              <span>{recording ? '🔁 إعادة تسجيل' : '🎤 تسجيل'}</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">إدارة التعليق الصوتي 🎙️</h1>
          <p className="text-slate-500 mt-2">قم بتسجيل الأصوات البشرية للعبارات وأسماء الأماكن ليتم تشغيلها في التطبيق بدلاً من القارئ الآلي.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sidebar for Characters */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-lg text-slate-800 mb-4">الشخصيات الصوتية</h3>
            
            <div className="space-y-2 mb-6">
              {characters.map(char => (
                <button
                  key={char.id}
                  onClick={() => setActiveCharId(char.id)}
                  className={`w-full text-right px-4 py-3 rounded-xl font-bold transition-all ${
                    activeCharId === char.id 
                      ? 'bg-sky-50 text-sky-700 border border-sky-200' 
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <span className="ml-2">{char.gender === 'female' ? '👩' : '👨'}</span>
                  {char.name}
                </button>
              ))}
              {characters.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">لا توجد شخصيات. أضف شخصية للبدء.</p>
              )}
            </div>

            <div className="pt-6 border-t border-slate-100">
              <h4 className="text-sm font-bold text-slate-700 mb-3">إضافة شخصية جديدة</h4>
              <form onSubmit={handleAddCharacter} className="space-y-3">
                <input 
                  type="text" 
                  placeholder="اسم الشخصية (مثال: صوت سارة)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  required
                />
                <select 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  value={newCharGender}
                  onChange={(e) => setNewCharGender(e.target.value)}
                >
                  <option value="female">صوت أنثى 👩</option>
                  <option value="male">صوت ذكر 👨</option>
                </select>
                <button type="submit" className="w-full bg-sky-500 text-white font-bold py-2 rounded-lg text-sm hover:bg-sky-600">
                  + إضافة
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Main Content for Recordings */}
        <div className="lg:col-span-3 space-y-6">
          {!activeCharId ? (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 border-dashed p-12 text-center">
              <span className="text-4xl">🎙️</span>
              <h3 className="text-lg font-bold text-slate-700 mt-4">اختر أو أضف شخصية صوتية للبدء بالتسجيل</h3>
            </div>
          ) : (
            <>
              {/* Static Phrases Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-slate-800">العبارات الثابتة</h2>
                  <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full">{STATIC_PHRASES.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {STATIC_PHRASES.map(phrase => renderPhraseItem(phrase.key, phrase.label, phrase.text))}
                </div>
              </div>

              {/* Dynamic Points Section */}
              <div className="space-y-4 pt-8">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-slate-800">أسماء المعالم والنقاط</h2>
                  <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full">{points.length}</span>
                </div>
                <p className="text-sm text-slate-500 mb-4">سجل اسم كل نقطة كما هو مكتوب ليتم دمجه مع عبارة "أنت الآن بالقرب من..."</p>
                <div className="grid grid-cols-1 gap-4">
                  {points.map(point => renderPhraseItem(`point_${point.id}`, point.name, point.name))}
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
