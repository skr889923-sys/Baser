import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmergencyStatus, ReportStatus } from '@baser/types';

/** Confirm both the database write and its affected row, including RLS no-ops. */
export async function saveRequestStatus(client: SupabaseClient, table: 'emergency_requests' | 'reports', id: string,
  previous: EmergencyStatus | ReportStatus, next: EmergencyStatus | ReportStatus) {
  const { data, error } = await client.from(table)
    .update({ status: next, updated_at: new Date().toISOString() }).eq('id', id).eq('status', previous)
    .select('*').maybeSingle();
  if (error || !data) throw new Error('لم يتم تأكيد التحديث. ربما تغيرت حالة الطلب أو صلاحياتك؛ حدّث البيانات وأعد المحاولة.');
  return data;
}
