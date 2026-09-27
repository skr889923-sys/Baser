import { parseNetwork, CampusNetwork, NetworkPlan, findNetworkPath, toNavigationPlan, Destination } from '@baser/navigation';
import type { RouteType } from '@baser/types';
import { supabase } from '../lib/supabase';

async function withTimeout<T>(run: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try { return await run(controller.signal); } finally { clearTimeout(timer); }
}

class CampusNetworkService {
  async list(): Promise<CampusNetwork[]> {
    const { data, error } = await withTimeout(signal => supabase.from('campus_networks').select('document').eq('is_published', true).abortSignal(signal));
    if (error) throw new Error('تعذر تحميل شبكات الحرم. تحقق من الاتصال وإعداد قاعدة البيانات.');
    // Invalid/expired snapshots never become selectable live networks.
    return (data ?? []).flatMap(row => {
      try { return [parseNetwork(row.document, { live: true })]; } catch { return []; }
    });
  }

  async get(id: string): Promise<CampusNetwork> {
    const { data, error } = await withTimeout(signal => supabase.from('campus_networks').select('document').eq('id', id).eq('is_published', true).abortSignal(signal).single());
    if (error || !data) throw new Error('تعذر تأكيد إتاحة الشبكة. توقف وأعد التحقق من الاتصال أو اطلب المساعدة.');
    try { return parseNetwork(data.document, { live: true }); }
    catch { throw new Error('بيانات الشبكة غير صالحة للإرشاد الآن. توقف واطلب المساعدة.'); }
  }

  async plan(id: string, start: string, destination: Destination, profile: RouteType): Promise<NetworkPlan | null> {
    const network = await this.get(id);
    const path = findNetworkPath(network, start, destination, profile);
    return path?.legs.length ? toNavigationPlan(network, path) : null;
  }

  async checkActive(reference: NetworkPlan['network']): Promise<void> {
    const network = await this.get(reference.id);
    if (network.revision !== reference.revision) throw new Error('تغيرت بيانات الشبكة أثناء الرحلة. توقف وأعد حساب المسار.');
    if (!reference.edgeIds.every(id => network.edges.features.some(e => e.properties.id === id && e.properties.status === 'active'))) {
      throw new Error('أصبح أحد مقاطع المسار غير متاح. توقف وأعد حساب المسار.');
    }
  }
}
export default new CampusNetworkService();
