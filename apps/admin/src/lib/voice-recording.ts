import type { SupabaseClient } from '@supabase/supabase-js';
import type { VoiceRecording } from '@baser/types';

export type RecordingDraft = {
  characterId: string; phraseKey: string; blob: Blob; path: string;
  previous?: VoiceRecording | null;
  recordId?: string; audioUrl?: string; uploaded?: boolean;
};

export function createRecordingDraft(characterId: string, phraseKey: string, blob: Blob): RecordingDraft {
  if (!characterId || !phraseKey || !blob.size) throw new Error('التسجيل فارغ؛ سجّل المقطع مجددًا.');
  const mime = blob.type.split(';')[0];
  const extension = ({ 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav' } as Record<string, string>)[mime];
  if (!extension) throw new Error('تنسيق التسجيل غير مدعوم في هذا المتصفح.');
  return { characterId, phraseKey, blob,
    path: `${characterId}/${phraseKey.replace(/[^a-zA-Z0-9._-]/g, '_')}-${crypto.randomUUID()}.${extension}` };
}

// New recordings for the same character/phrase share an id across tabs. This
// prevents concurrent first-insert duplicates even without a legacy compound
// unique index. Existing random ids are retained and updated by id.
export async function recordingId(characterId: string, phraseKey: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(JSON.stringify(['baser:voice-recording:v1', characterId, phraseKey]))));
  bytes[6] = (bytes[6] & 15) | 128;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes.slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function saveVoiceRecording(client: SupabaseClient, draft: RecordingDraft): Promise<VoiceRecording> {
  if (draft.previous === undefined) {
    const { data, error } = await client.from('voice_recordings').select('*')
      .eq('character_id', draft.characterId).eq('phrase_key', draft.phraseKey).maybeSingle();
    if (error) throw new Error('تعذر التحقق من التسجيل السابق. إذا تكرر الخطأ، راجع الصلاحيات أو وجود تسجيلات مكررة للعبارة.');
    draft.previous = data;
  }
  draft.recordId ||= draft.previous?.id || await recordingId(draft.characterId, draft.phraseKey);
  draft.audioUrl ||= client.storage.from('voiceovers').getPublicUrl(draft.path).data.publicUrl;

  // Recover a committed metadata write whose response was lost. Never remove
  // an uploaded object on an uncertain failure: its URL may already be saved.
  const current = await client.from('voice_recordings').select('*').eq('id', draft.recordId).maybeSingle();
  if (current.error) throw new Error('تعذر تأكيد حالة الحفظ. المقطع محفوظ مؤقتًا هنا لإعادة المحاولة.');
  if (current.data && (current.data.character_id !== draft.characterId || current.data.phrase_key !== draft.phraseKey)) {
    throw new Error('تعارض في معرّف التسجيل. لم يُستبدل أي تسجيل.');
  }
  if (current.data?.audio_url === draft.audioUrl) return current.data as VoiceRecording;
  if ((draft.previous && (!current.data || current.data.audio_url !== draft.previous.audio_url))
    || (!draft.previous && current.data)) {
    throw new Error('تغيّر التسجيل لدى مستخدم آخر. نزّل مقطعك، ثم حدّث القائمة قبل استبداله.');
  }
  if (!draft.uploaded) {
    const { error } = await client.storage.from('voiceovers').upload(draft.path, draft.blob,
      { contentType: draft.blob.type, upsert: true });
    if (error) throw new Error('تعذر تأكيد رفع الصوت. أعد المحاولة بالمقطع نفسه أو نزّله للاحتفاظ به.');
    draft.uploaded = true;
  }

  const payload = { character_id: draft.characterId, phrase_key: draft.phraseKey, audio_url: draft.audioUrl };
  const query = draft.previous
    ? client.from('voice_recordings').update(payload).eq('id', draft.recordId).eq('audio_url', draft.previous.audio_url)
    : client.from('voice_recordings').insert({ id: draft.recordId, ...payload });
  const { data, error } = await query.select('*').maybeSingle();
  if (error?.code === '23505' || (!error && !data)) throw new Error('لم يُؤكّد الحفظ؛ قد تكون العبارة عُدّلت في جلسة أخرى. أعد التحقق قبل استبدالها.');
  if (error || !data?.id || data.audio_url !== draft.audioUrl) {
    throw new Error('رُفع المقطع، لكن لم يُؤكّد حفظ رابطه. أعد المحاولة؛ لن يُرفع ملف جديد.');
  }
  return data as VoiceRecording;
}
