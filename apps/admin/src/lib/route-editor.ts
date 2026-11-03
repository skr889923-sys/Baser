import type { Route, RouteStatus } from '@baser/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export function routeWriteError(cause: unknown): string {
  const error = cause && typeof cause === 'object'
    ? cause as { code?: string; message?: string } : {};
  if (['42501', '42P17'].includes(error.code || '')) {
    return 'رفضت قاعدة البيانات العملية. تحقق من صلاحيات حسابك وصلاحيات محرر الخرائط.';
  }
  if (error.code === '23503') {
    return 'تعذر حذف المسار لوجود بيانات مرتبطة تمنع الحذف. راجع ارتباطاته أو أغلقه مؤقتًا.';
  }
  if (['PGRST204', '42703'].includes(error.code || '')) {
    return 'بنية قاعدة البيانات غير متوافقة مع إدارة المسارات. راجع تحديثات قاعدة البيانات.';
  }
  return cause instanceof Error ? cause.message : 'تعذر تأكيد العملية. حدّث القائمة قبل إعادة المحاولة.';
}

// Delete the parent once; PostgreSQL removes its steps and route sessions in
// the same transaction. Never delete children before confirming the parent.
export async function deleteRoute(client: SupabaseClient, previous: Route): Promise<string> {
  const { data, error } = await client.from('routes').delete()
    .eq('id', previous.id).eq('updated_at', previous.updated_at)
    .select('id').maybeSingle();
  if (error) throw new Error(routeWriteError(error));
  if (data?.id !== previous.id) {
    throw new Error('لم يُؤكّد حذف المسار. ربما تغيّر أو حُذف أو انتهت صلاحياتك؛ حدّث القائمة.');
  }
  return data.id;
}

export async function setRouteStatus(client: SupabaseClient, previous: Route, status: RouteStatus): Promise<Route> {
  const { data, error } = await client.from('routes')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', previous.id).eq('updated_at', previous.updated_at).eq('status', previous.status)
    .select('*').maybeSingle();
  if (error) throw new Error(routeWriteError(error));
  if (data?.id !== previous.id) {
    throw new Error('لم يُؤكّد تغيير حالة المسار. حدّث القائمة وتحقق من صلاحياتك.');
  }
  return data as Route;
}
