import type { Building, BuildingType } from '@baser/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export type BuildingSchema = 'coded' | 'classic';
export type BuildingDraft = {
  name_ar: string; name_en: string; code: string;
  description_ar: string; description_en: string;
  latitude: string; longitude: string;
  type: BuildingType | ''; accessibility: '' | 'yes' | 'no';
  is_active: boolean;
};
type BuildingWrite = {
  name_ar: string; name_en: string;
  description_ar: string; description_en: string;
  latitude: number | null; longitude: number | null;
  is_active: boolean;
  code?: string; type?: BuildingType; is_accessible?: boolean;
};
export const emptyBuildingDraft = (): BuildingDraft => ({
  name_ar: '', name_en: '', code: '', description_ar: '', description_en: '',
  latitude: '', longitude: '', type: '', accessibility: '', is_active: true,
});

// A zero-row read distinguishes the two known schema contracts, even on an
// empty database. Never retry a failed write with silently altered data.
export async function detectBuildingSchema(client: SupabaseClient): Promise<BuildingSchema> {
  const { error } = await client.from('buildings').select('code').limit(0);
  if (!error) return 'coded';
  if (error.code === '42703') return 'classic';
  throw new Error('تعذر التحقق من حقول المباني. أعد تحميل القائمة قبل الحفظ.');
}

export function buildingPayload(draft: BuildingDraft, schema: BuildingSchema): BuildingWrite {
  const name_ar = draft.name_ar.trim(), name_en = draft.name_en.trim();
  if (!name_ar || !name_en) throw new Error('اكتب اسم المبنى بالعربية والإنجليزية.');
  const lat = draft.latitude.trim(), lon = draft.longitude.trim();
  if (Boolean(lat) !== Boolean(lon)) throw new Error('أدخل خط العرض والطول معًا، أو اتركهما فارغين.');
  if (schema === 'classic' && !lat) throw new Error('أدخل إحداثيات المبنى الفعلية؛ هذه القاعدة تتطلبها.');
  const latitude = lat ? Number(lat) : null, longitude = lon ? Number(lon) : null;
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || longitude === null || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    throw new Error('الإحداثيات غير صالحة. خط العرض بين −90 و90، والطول بين −180 و180.');
  }
  const common = { name_ar, name_en, description_ar: draft.description_ar.trim(),
    description_en: draft.description_en.trim(), latitude, longitude, is_active: draft.is_active };
  if (schema === 'coded') {
    if (!draft.code.trim()) throw new Error('أدخل رمز المبنى.');
    return { ...common, code: draft.code.trim() };
  }
  if (!draft.type || !draft.accessibility) throw new Error('اختر نوع المبنى وحالة تهيئته بعد التحقق منها.');
  return { ...common, type: draft.type, is_accessible: draft.accessibility === 'yes' };
}

export async function saveBuilding(client: SupabaseClient, draft: BuildingDraft, schema: BuildingSchema, previous: Building | null) {
  const payload = buildingPayload(draft, schema);
  const query = previous
    ? client.from('buildings').update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', previous.id).eq('updated_at', previous.updated_at)
    : client.from('buildings').insert(payload);
  const { data, error } = await query.select('*').maybeSingle();
  if (error?.code === '23505') throw new Error('رمز المبنى مستخدم بالفعل. حدّث القائمة أو اختر رمزًا مختلفًا.');
  if (error) throw new Error('تعذر تأكيد الحفظ. احتُفظ بالمدخلات؛ حدّث القائمة قبل إعادة المحاولة.');
  if (!data?.id) throw new Error('لم يُؤكّد الحفظ. ربما تغيّر المبنى أو صلاحيات الحساب؛ حدّث القائمة.');
  return data as Building;
}

export async function setBuildingActive(client: SupabaseClient, previous: Building) {
  const { data, error } = await client.from('buildings')
    .update({ is_active: !previous.is_active, updated_at: new Date().toISOString() })
    .eq('id', previous.id).eq('is_active', previous.is_active).eq('updated_at', previous.updated_at)
    .select('*').maybeSingle();
  if (error || !data?.id) throw new Error('لم يُؤكّد تغيير الحالة. حدّث القائمة وتحقق من صلاحيات الحساب.');
  return data as Building;
}
