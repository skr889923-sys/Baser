import type { RequestReceipt } from '@baser/types';

export type RequestKind = 'emergency' | 'report';
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
type RPC = (name: string, args: Record<string, unknown>, signal: AbortSignal) => PromiseLike<{
  data: unknown; error: { code?: string } | null;
}>;

export class RequestFailure extends Error {
  constructor(public readonly reason: 'unconfirmed' | 'setup_required' | 'storage' | 'missing') {
    super(reason);
  }
}

export function parseReceipt(value: unknown, kind: RequestKind): RequestReceipt {
  const receipt = value as RequestReceipt | null;
  const statuses = kind === 'emergency'
    ? ['new', 'contacted', 'arrived', 'resolved', 'cancelled']
    : ['new', 'investigating', 'resolved', 'rejected'];
  if (!receipt || typeof receipt.id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(receipt.id)
    || !statuses.includes(receipt.status) || typeof receipt.location_available !== 'boolean'
    || !Number.isFinite(Date.parse(receipt.created_at)) || !Number.isFinite(Date.parse(receipt.updated_at))) {
    throw new RequestFailure('unconfirmed');
  }
  return receipt;
}

/** One durable capability per request. A retry reuses it even after a lost response. */
export class RequestClient {
  private pending = new Map<RequestKind, Promise<RequestReceipt>>();
  constructor(private rpc: RPC, private storage: Storage, private randomToken: () => Promise<string>, private timeoutMs = 15000) {}

  private key(kind: RequestKind) { return `baser.${kind}.request-token.v1`; }

  private async token(kind: RequestKind, create: boolean): Promise<string | null> {
    try {
      const saved = await this.storage.getItem(this.key(kind));
      if (saved && /^[0-9a-f]{64}$/.test(saved)) return saved;
      // Never overwrite a corrupted receipt and risk silently duplicating an SOS.
      if (saved) throw new Error('Invalid stored capability');
      if (!create) return null;
      const token = await this.randomToken();
      if (!/^[0-9a-f]{64}$/.test(token)) throw new Error('Invalid generated capability');
      await this.storage.setItem(this.key(kind), token);
      return token;
    } catch { throw new RequestFailure('storage'); }
  }

  private async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    try {
      const result = await Promise.race([
        Promise.resolve(this.rpc(name, args, controller.signal)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new RequestFailure('unconfirmed')); }, this.timeoutMs);
        }),
      ]);
      if (result.error) {
        throw new RequestFailure(['PGRST202', '42883'].includes(result.error.code ?? '') ? 'setup_required' : 'unconfirmed');
      }
      return result.data;
    } catch (error) {
      if (error instanceof RequestFailure) throw error;
      throw new RequestFailure('unconfirmed');
    } finally { clearTimeout(timer!); }
  }

  async resume(kind: RequestKind): Promise<RequestReceipt | null> {
    const token = await this.token(kind, false);
    if (!token) return null;
    const data = await this.call('mobile_request_receipt', { request_kind: kind, request_token: token });
    return data === null ? null : parseReceipt(data, kind);
  }

  submit(kind: RequestKind, data: Record<string, unknown>): Promise<RequestReceipt> {
    const existing = this.pending.get(kind);
    if (existing) return existing;
    const task = (async () => {
      const token = await this.token(kind, true);
      return parseReceipt(await this.call('submit_mobile_request', {
        request_kind: kind, request_token: token, request_data: data,
      }), kind);
    })().finally(() => this.pending.delete(kind));
    this.pending.set(kind, task);
    return task;
  }

  async cancelEmergency(): Promise<RequestReceipt> {
    const token = await this.token('emergency', false);
    if (!token) throw new RequestFailure('missing');
    return parseReceipt(await this.call('cancel_mobile_emergency', { request_token: token }), 'emergency');
  }

  async newRequest(kind: RequestKind): Promise<void> {
    if (this.pending.has(kind)) throw new RequestFailure('unconfirmed');
    const receipt = await this.resume(kind);
    if (kind === 'emergency' && (!receipt || !['resolved', 'cancelled'].includes(receipt.status))) {
      throw new RequestFailure('unconfirmed');
    }
    try { await this.storage.removeItem(this.key(kind)); }
    catch { throw new RequestFailure('storage'); }
  }
}

export function requestErrorMessage(error: unknown, language: 'ar' | 'en'): string {
  const reason = error instanceof RequestFailure ? error.reason : 'unconfirmed';
  if (reason === 'setup_required') return language === 'ar'
    ? 'خدمة الطلبات غير جاهزة حاليًا. اطلب المساعدة مباشرة من فريق الموقع.'
    : 'The request service is unavailable. Ask site staff for help directly.';
  if (reason === 'storage') return language === 'ar'
    ? 'تعذر حفظ مرجع الطلب على جهازك. اطلب المساعدة مباشرة من فريق الموقع.'
    : 'Could not save the request reference on this device. Ask site staff for help directly.';
  return language === 'ar'
    ? 'لم نتمكن من تأكيد حالة الطلب. تحقق من الاتصال وأعد المحاولة؛ لن تنشئ إعادة المحاولة طلبًا مكررًا. إذا كانت المساعدة عاجلة، اطلبها مباشرة من فريق الموقع.'
    : 'The request could not be confirmed. Check your connection and retry; retries do not create duplicates. For urgent help, contact site staff directly.';
}
