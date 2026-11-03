import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '@baser/types';

export const isAdministrator = (role: UserRole | null) => role === 'super_admin' || role === 'university_admin';
export type ManagedTable = 'buildings' | 'qr_codes' | 'reports' | 'emergency_requests' | 'profiles' | 'voice_characters' | 'voice_recordings' | 'campus_networks';
export type ManagedRecord = { id: string; [key: string]: unknown };
export type RecordField = { key: string; label: string; type?: 'text' | 'textarea' | 'number' | 'select'; required?: boolean; options?: [string, string][] };
export const roleOptions: [string, string][] = [['super_admin','مدير النظام'],['university_admin','إداري الجامعة'],['building_manager','مشرف مبنى'],['support_agent','الدعم'],['security_staff','الأمن'],['student','طالب']];

export function administrationError(cause: unknown): string {
  const error = cause as { code?: string; message?: string } | null;
  if (['PGRST202','42883'].includes(error?.code || '')) return 'يلزم تطبيق تحديث الإدارة الشاملة على قاعدة البيانات لتفعيل هذه العملية.';
  if (error?.code === '42501') return 'هذه العملية متاحة للإدارة العليا فقط، وقد تكون الصلاحية المطلوبة أعلى من صلاحية حسابك.';
  if (error?.code === 'PT409') return 'تغيّرت البيانات منذ فتحها. حدّث القائمة وافتح السجل مجددًا.';
  if (error?.code === 'PT422') return error.message || 'تمنع ارتباطات السجل تنفيذ العملية.';
  if (error?.code === '23503') return 'تمنع بيانات مرتبطة حذف السجل. راجع الارتباطات أولًا.';
  if (error?.code === '23505') return 'القيمة مستخدمة بالفعل. اختر قيمة مختلفة.';
  if (error?.code === '23514' || error?.code === '22023') return error.message || 'تحقق من الحقول المطلوبة وصحة القيم.';
  return error?.message || 'تعذر تأكيد العملية. احتُفظ بالبيانات؛ حدّث القائمة قبل إعادة المحاولة.';
}

export async function manageRecord(client: SupabaseClient, table: ManagedTable, row: ManagedRecord, fields: RecordField[], patch: Record<string, unknown> | null) {
  const expected: Record<string, unknown> = { id: row.id };
  const keys = ['updated_at','revision',...fields.map(field => field.key)];
  for (const key of keys) if (key in row) expected[key] = row[key];
  // Compare stable metadata as well for records without a version column.
  if (!fields.length && !('updated_at' in row) && !('revision' in row)) {
    for (const key of ['name','gender','character_id','phrase_key','audio_url','code_content','role','full_name']) if (key in row) expected[key] = row[key];
  }
  const { data, error } = await client.rpc('admin_manage_record', { target_table: table, record_id: row.id, expected, patch, remove: patch === null });
  if (error) throw new Error(administrationError(error));
  if (!data || data.id !== row.id) throw new Error('لم تُؤكّد العملية. حدّث القائمة قبل إعادة المحاولة.');
  return data as ManagedRecord;
}
