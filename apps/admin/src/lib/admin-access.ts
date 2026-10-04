import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { UserRole } from '@baser/types';

const editors: UserRole[] = ['super_admin', 'university_admin', 'building_manager'];
const responders: UserRole[] = ['super_admin', 'university_admin', 'security_staff', 'support_agent'];
const reviewers: UserRole[] = ['super_admin', 'university_admin', 'building_manager', 'support_agent'];

export function canAccessPage(role: UserRole | null, pathname: string): boolean {
  if (!role || role === 'student') return false;
  if (pathname === '/') return [...editors, ...responders].includes(role);
  const page = pathname.split('/')[1];
  if (['maps', 'networks', 'buildings', 'points', 'routes', 'qrs'].includes(page)) return editors.includes(role);
  if (page === 'emergency') return responders.includes(role);
  if (['reports', 'voices'].includes(page)) return reviewers.includes(role);
  if (page === 'users') return ['super_admin', 'university_admin'].includes(role);
  return false;
}

export async function getAdminIdentity(client: SupabaseClient): Promise<{ user: User; role: UserRole } | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  const result = await client.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (result.error) throw new Error('تعذر التحقق من صلاحيات الحساب. أعد المحاولة أو راجع مسؤول النظام.');
  if (!result.data || !canAccessPage(result.data.role, '/')) throw new Error('هذا الحساب لا يملك صلاحية الدخول إلى لوحة التشغيل.');
  return { user: data.user, role: result.data.role };
}
