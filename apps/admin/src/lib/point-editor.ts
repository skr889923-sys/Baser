import type { NavigationPoint, PointType } from '@baser/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PointDraft = {
  building_id: string; floor_id: string;
  name_ar: string; name_en: string; type: PointType;
  latitude: string; longitude: string; indoor_x: string; indoor_y: string;
  description_ar: string; description_en: string;
  audio_instruction_ar: string; audio_instruction_en: string;
  is_accessible: boolean; is_hazard: boolean; is_active: boolean;
};

export const pointTypes: [PointType, string][] = [
  ['entrance', 'مدخل'], ['exit', 'مخرج'], ['elevator', 'مصعد'], ['stairs', 'درج'],
  ['ramp', 'منحدر'], ['corridor', 'ممر'], ['intersection', 'تقاطع'],
  ['restroom', 'دورة مياه'], ['office', 'مكتب'], ['hall', 'قاعة'],
  ['qr_spot', 'موضع QR'], ['hazard', 'نقطة خطر'],
];

export const emptyPointDraft = (): PointDraft => ({
  building_id: '', floor_id: '', name_ar: '', name_en: '', type: 'corridor',
  latitude: '', longitude: '', indoor_x: '', indoor_y: '',
  description_ar: '', description_en: '', audio_instruction_ar: '', audio_instruction_en: '',
  is_accessible: true, is_hazard: false, is_active: true,
});

export function pointDraft(point: NavigationPoint): PointDraft {
  return {
    building_id: point.building_id || '', floor_id: point.floor_id || '',
    name_ar: point.name_ar, name_en: point.name_en, type: point.type,
    latitude: point.latitude == null ? '' : String(point.latitude),
    longitude: point.longitude == null ? '' : String(point.longitude),
    indoor_x: point.indoor_x == null ? '' : String(point.indoor_x),
    indoor_y: point.indoor_y == null ? '' : String(point.indoor_y),
    description_ar: point.description_ar || '', description_en: point.description_en || '',
    audio_instruction_ar: point.audio_instruction_ar || '', audio_instruction_en: point.audio_instruction_en || '',
    is_accessible: point.is_accessible, is_hazard: point.is_hazard, is_active: point.is_active,
  };
}

function coordinatePair(first: string, second: string, geographic: boolean): [number | null, number | null] {
  const a = first.trim(), b = second.trim();
  if (Boolean(a) !== Boolean(b)) throw new Error('أدخل الإحداثيات معًا، أو اترك الحقلين فارغين.');
  if (!a) return [null, null];
  const x = Number(a), y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)
    || (geographic && (x < -90 || x > 90 || y < -180 || y > 180))) {
    throw new Error('الإحداثيات غير صالحة. خط العرض بين −90 و90، والطول بين −180 و180.');
  }
  return [x, y];
}

export function pointPayload(draft: PointDraft) {
  const name_ar = draft.name_ar.trim(), name_en = draft.name_en.trim();
  if (!name_ar || !name_en) throw new Error('اكتب اسم النقطة بالعربية والإنجليزية.');
  if (!pointTypes.some(([type]) => type === draft.type)) throw new Error('اختر نوعًا صالحًا للنقطة.');
  if (draft.floor_id && !draft.building_id) throw new Error('اختر مبنى للطابق المحدد.');
  const [latitude, longitude] = coordinatePair(draft.latitude, draft.longitude, true);
  const [indoor_x, indoor_y] = coordinatePair(draft.indoor_x, draft.indoor_y, false);
  return {
    building_id: draft.building_id || null, floor_id: draft.floor_id || null,
    name_ar, name_en, type: draft.type, latitude, longitude, indoor_x, indoor_y,
    description_ar: draft.description_ar.trim(), description_en: draft.description_en.trim(),
    audio_instruction_ar: draft.audio_instruction_ar.trim(), audio_instruction_en: draft.audio_instruction_en.trim(),
    is_accessible: draft.is_accessible, is_hazard: draft.is_hazard, is_active: draft.is_active,
  };
}

export function pointWriteError(cause: unknown): string {
  const error = cause && typeof cause === 'object'
    ? cause as { code?: string; message?: string } : {};
  if (error.code === 'PT422') return 'لا يمكن حذف نقطة مرتبطة بمسار أو رمز QR. عدّل الارتباطات أولًا، أو عطّل النقطة بدلًا من حذفها.';
  if (error.code === 'PT409') return 'تغيّرت النقطة أو حُذفت منذ تحميلها. حدّث القائمة قبل إعادة المحاولة.';
  if (['42501', '42P17'].includes(error.code || '')) return 'حسابك لا يملك صلاحية تنفيذ العملية. راجع صلاحيات محرر الخرائط.';
  if (['PGRST202', 'PGRST204', '42883', '42703'].includes(error.code || '')) {
    return 'يلزم تحديث قاعدة البيانات لإدارة النقاط. اطلب تطبيق تحديث إدارة نقاط التوجيه ثم أعد المحاولة.';
  }
  if (error.code === '23503') return 'تعذر تنفيذ العملية بسبب ارتباط النقطة ببيانات أخرى. حدّث القائمة وتحقق من المبنى والطابق والارتباطات.';
  return cause instanceof Error ? cause.message : 'تعذر تأكيد العملية. احتُفظ بالبيانات؛ حدّث القائمة قبل إعادة المحاولة.';
}

export async function saveNavigationPoint(client: SupabaseClient, draft: PointDraft, previous: NavigationPoint | null) {
  const payload = pointPayload(draft);
  const query = previous
    ? client.from('navigation_points').update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', previous.id).eq('updated_at', previous.updated_at)
    : client.from('navigation_points').insert(payload);
  const { data, error } = await query.select('*').maybeSingle();
  if (error) throw new Error(pointWriteError(error));
  if (!data?.id) throw new Error(pointWriteError({ code: 'PT409' }));
  return data as NavigationPoint;
}

export async function setNavigationPointActive(client: SupabaseClient, previous: NavigationPoint) {
  const { data, error } = await client.from('navigation_points')
    .update({ is_active: !previous.is_active, updated_at: new Date().toISOString() })
    .eq('id', previous.id).eq('updated_at', previous.updated_at).eq('is_active', previous.is_active)
    .select('*').maybeSingle();
  if (error) throw new Error(pointWriteError(error));
  if (!data?.id) throw new Error(pointWriteError({ code: 'PT409' }));
  return data as NavigationPoint;
}

export async function deleteNavigationPoint(client: SupabaseClient, previous: NavigationPoint) {
  const { data, error } = await client.rpc('delete_navigation_point', {
    point_id: previous.id, expected_updated_at: previous.updated_at,
  });
  if (error) throw new Error(pointWriteError(error));
  if (data !== previous.id) throw new Error('لم يُؤكّد حذف النقطة. حدّث القائمة قبل إعادة المحاولة.');
  return data as string;
}
