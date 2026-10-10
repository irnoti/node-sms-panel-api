import { IrnotiApiError } from './errors.js';

export interface ClientOptions {
  /** `irn_live_…` or `irn_test_…`. */
  apiKey: string;
  /** Default `https://api.irnoti.com` (the client appends `/v1`). */
  baseUrl?: string;
  /** Per-request timeout in ms. Default 15000. */
  timeoutMs?: number;
  /** Extra attempts for network errors / 5xx on idempotent-safe calls (GET, or calls with an Idempotency-Key). Default 1. */
  retries?: number;
  fetch?: typeof fetch;
}

export type Query = Record<string, string | number | boolean | undefined | null>;

/** Low-level transport; use the typed resources on {@link Irnoti} instead. */
export class Transport {
  private readonly base: string;
  private readonly f: typeof fetch;
  constructor(private readonly o: ClientOptions) {
    if (!o.apiKey) throw new Error('irnoti: apiKey is required');
    this.base = (o.baseUrl ?? 'https://api.irnoti.com').replace(/\/+$/, '') + '/v1';
    this.f = o.fetch ?? fetch;
  }

  async request<T = unknown>(method: string, path: string, opts: { query?: Query; body?: unknown; headers?: Record<string, string>; form?: FormData } = {}): Promise<T> {
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    const headers: Record<string, string> = { Authorization: `Bearer ${this.o.apiKey}`, Accept: 'application/json', ...opts.headers };
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }

    const retryable = method === 'GET' || 'Idempotency-Key' in headers;
    const attempts = 1 + (retryable ? this.o.retries ?? 1 : 0);
    let last: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await this.f(url, { method, headers, body, signal: AbortSignal.timeout(this.o.timeoutMs ?? 15_000) });
        if (res.status >= 500 && i < attempts - 1) { last = new IrnotiApiError(`HTTP ${res.status}`, res.status, ''); continue; }
        return await this.unwrap<T>(res);
      } catch (e) {
        if (e instanceof IrnotiApiError) throw e;
        last = e;
      }
    }
    throw last;
  }

  private async unwrap<T>(res: Response): Promise<T> {
    const text = await res.text();
    let json: any;
    try { json = text ? JSON.parse(text) : undefined; } catch { json = undefined; }
    if (!res.ok) {
      const m = json?.message;
      const message = Array.isArray(m) ? m.join(' ') : typeof m === 'string' && m ? m : `irnoti API error (HTTP ${res.status})`;
      throw new IrnotiApiError(message, res.status, String(json?.code ?? ''), json?.details);
    }
    return json as T;
  }
}
