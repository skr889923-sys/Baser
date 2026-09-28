import type { SupabaseClient } from '@supabase/supabase-js';

export async function requireMapEditorAccess(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error('جلسة الدخول غير صالحة. سجّل الدخول مجددًا قبل حفظ النقاط أو المسارات.');
  }
  const { data: profile, error: profileError } = await client
    .from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (profileError) {
    throw new Error('تعذر التحقق من صلاحيات حسابك. اطلب من مسؤول النظام مراجعة إعدادات الوصول.');
  }
  if (!profile || !['super_admin', 'university_admin', 'building_manager'].includes(profile.role)) {
    throw new Error('حسابك لا يملك صلاحية تحرير الخرائط. اطلب من مسؤول النظام تفعيل دور إداري مناسب لحسابك.');
  }
}

export function mapWriteError(cause: unknown): string {
  const error = cause && typeof cause === 'object' && 'message' in cause
    ? { message: String(cause.message), code: 'code' in cause ? String(cause.code) : undefined }
    : { message: 'تعذر الاتصال. أعد المحاولة.', code: undefined };
  if (['PGRST202', 'PGRST204', '42703', '42883'].includes(error.code ?? '')) {
    return 'يلزم تحديث قاعدة البيانات لتوافق إصدار التطبيق. اطلب من مسؤول النظام تطبيق تحديث خطوات المسار، ثم أعد المحاولة.';
  }
  if (error.code === '42501' || error.code === '42P17') {
    return 'رفضت قاعدة البيانات الحفظ بسبب إعدادات الصلاحيات. اطلب من مسؤول النظام تحديث صلاحيات محرر الخرائط، ثم أعد المحاولة.';
  }
  return `تعذر الحفظ: ${error.message}`;
}
