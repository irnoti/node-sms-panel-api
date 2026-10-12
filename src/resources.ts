import type { Transport } from './client.js';
import type { AddContactsResult, BatchResult, ContactInput, Group, Id, Line, Message, Quote, SendOptions, ServiceProduct } from './types.js';

type Json = Record<string, unknown>;
const e = (id: Id) => encodeURIComponent(String(id));
const idem = (key?: string) => (key ? { 'Idempotency-Key': key } : undefined);
const iso = (d?: Date | string) => (d instanceof Date ? d.toISOString() : d);
const ids = (g?: Id[]) => g?.map(String);
const page = (take?: number, before?: Id) => ({ take, before: before === undefined ? undefined : String(before) });

export class Sms {
  constructor(private t: Transport) {}
  /** Scope `sms.send`. Use `lineId: 'sandbox'` with an `irn_test_` key to try for free. */
  send(o: SendOptions) {
    return this.t.request<BatchResult>('POST', '/sms/send', {
      headers: idem(o.idempotencyKey),
      body: { lineId: String(o.lineId), to: o.to, groupIds: ids(o.groupIds), text: o.text, scheduledAt: iso(o.scheduledAt), gradual: o.gradual },
    });
  }
  /** Scope `sms.read`: exact cost without sending. */
  quote(o: Omit<SendOptions, 'idempotencyKey' | 'scheduledAt' | 'gradual'>) {
    return this.t.request<Quote>('POST', '/sms/quote', { body: { lineId: String(o.lineId), to: o.to, groupIds: ids(o.groupIds), text: o.text } });
  }
  /** Approved template (pattern). Scope `sms.send`. */
  pattern(code: string, to: string, params: Record<string, string | number> = {}, idempotencyKey?: string) {
    return this.t.request<BatchResult>('POST', '/sms/pattern', { headers: idem(idempotencyKey), body: { code, to, params } });
  }
  /** Guaranteed delivery with provider failover (≤ 200 recipients, `sms.sos` tariff). */
  sos(to: string | string[], text: string, idempotencyKey?: string) {
    return this.t.request<BatchResult>('POST', '/sms/sos', { headers: idem(idempotencyKey), body: { to, text } });
  }
}

export class Messages {
  constructor(private t: Transport) {}
  list(o: { take?: number; before?: Id } = {}) { return this.t.request<Message[]>('GET', '/sms/messages', { query: page(o.take, o.before) }); }
  get(id: Id) { return this.t.request<Message>('GET', `/sms/messages/${e(id)}`); }
  /** Ask the operator for the final state now (30/min). */
  check(id: Id) { return this.t.request<Message>('POST', `/sms/messages/${e(id)}/check`); }
}

export class Batches {
  constructor(private t: Transport) {}
  scheduled() { return this.t.request<Json[]>('GET', '/sms/scheduled'); }
  cancel(batchId: Id) { return this.t.request<Json>('POST', `/sms/batches/${e(batchId)}/cancel`); }
  async pause(batchId: Id) { await this.t.request('POST', `/sms/batches/${e(batchId)}/pause`); }
  async resume(batchId: Id) { await this.t.request('POST', `/sms/batches/${e(batchId)}/resume`); }
}

export class Lines {
  constructor(private t: Transport) {}
  list() { return this.t.request<Line[]>('GET', '/sms/lines'); }
}

export class Wallet {
  constructor(private t: Transport) {}
  balance() { return this.t.request<{ balance: string; currency: string }>('GET', '/wallet'); }
  transactions() { return this.t.request<Json[]>('GET', '/wallet/transactions'); }
}

export class Phonebook {
  constructor(private t: Transport) {}
  groups() { return this.t.request<Group[]>('GET', '/phonebook/groups'); }
  createGroup(name: string) { return this.t.request<{ id: string; name: string }>('POST', '/phonebook/groups', { body: { name } }); }
  async deleteGroup(id: Id) { await this.t.request('DELETE', `/phonebook/groups/${e(id)}`); }
  contacts(groupId: Id, o: { take?: number; after?: Id; q?: string } = {}) {
    return this.t.request<Json>('GET', `/phonebook/groups/${e(groupId)}/contacts`, { query: { take: o.take, after: o.after === undefined ? undefined : String(o.after), q: o.q } });
  }
  /** Up to 10,000 per call; invalid/duplicate numbers are counted, not fatal. */
  addContacts(groupId: Id, contacts: ContactInput[]) {
    return this.t.request<AddContactsResult>('POST', `/phonebook/groups/${e(groupId)}/contacts`, { body: { contacts } });
  }
  /** CSV/TXT, one `mobile[,name]` per line (max 5 MB). */
  importCsv(groupId: Id, csv: string | Blob, filename = 'contacts.csv') {
    const form = new FormData();
    form.append('file', typeof csv === 'string' ? new Blob([csv], { type: 'text/csv' }) : csv, filename);
    return this.t.request<AddContactsResult>('POST', `/phonebook/groups/${e(groupId)}/import`, { form });
  }
  updateContact(id: Id, attrs: Partial<ContactInput> & { optedOut?: boolean }) { return this.t.request<Json>('PATCH', `/phonebook/contacts/${e(id)}`, { body: attrs }); }
  async deleteContact(id: Id) { await this.t.request('DELETE', `/phonebook/contacts/${e(id)}`); }
}

/** Regional / targeted / peyamap / smart / messenger / voice / international: quote → create → refresh → cancel. */
export class Services {
  constructor(private t: Transport) {}
  prices() { return this.t.request<Json[]>('GET', '/services/prices'); }
  internationalRates() { return this.t.request<Json>('GET', '/services/international/rates'); }
  list(product: ServiceProduct) { return this.t.request<Json[]>('GET', `/services/${product}`); }
  quote(product: ServiceProduct, body: Json) { return this.t.request<Json>('POST', `/services/${product}/quote`, { body }); }
  create(product: ServiceProduct, body: Json) { return this.t.request<Json>('POST', `/services/${product}`, { body }); }
  get(product: ServiceProduct, id: Id) { return this.t.request<Json>('GET', `/services/${product}/${e(id)}`); }
  refresh(product: ServiceProduct, id: Id) { return this.t.request<Json>('POST', `/services/${product}/${e(id)}/refresh`); }
  /** Only before the provider starts; refunded. */
  cancel(product: ServiceProduct, id: Id) { return this.t.request<Json>('POST', `/services/${product}/${e(id)}/cancel`); }
}

export class LinkTracker {
  constructor(private t: Transport) {}
  send(o: { lineId: Id; text: string; url: string; to?: string[]; groupIds?: Id[]; variants?: string[]; holdoutPercent?: number; decideAfterMinutes?: number }) {
    return this.t.request<Json>('POST', '/link-tracker/send', { body: { ...o, lineId: String(o.lineId), groupIds: ids(o.groupIds) } });
  }
  holdouts() { return this.t.request<Json[]>('GET', '/link-tracker/holdouts'); }
  sendNow(holdoutId: Id) { return this.t.request<Json>('POST', `/link-tracker/holdouts/${e(holdoutId)}/send-now`); }
  campaigns() { return this.t.request<Json[]>('GET', '/link-tracker/campaigns'); }
  campaign(batchId: Id) { return this.t.request<Json>('GET', `/link-tracker/campaigns/${e(batchId)}`); }
}

export interface BankSend { bankId: Id; count: number; lineId: Id; text: string; filters?: { operator?: string; province?: string; city?: string; tag?: string } }
export class NumberBanks {
  constructor(private t: Transport) {}
  list() { return this.t.request<Json[]>('GET', '/number-banks'); }
  facets(bankId: Id) { return this.t.request<Json>('GET', `/number-banks/${e(bankId)}/facets`); }
  quote(o: BankSend) { return this.t.request<Json>('POST', '/number-banks/quote', { body: this.body(o) }); }
  send(o: BankSend, idempotencyKey?: string) { return this.t.request<Json>('POST', '/number-banks/send', { body: this.body(o), headers: idem(idempotencyKey) }); }
  private body(o: BankSend) { return { bankId: String(o.bankId), count: o.count, lineId: String(o.lineId), text: o.text, filters: o.filters ?? {} }; }
}

export class Verify {
  constructor(private t: Transport) {}
  info() { return this.t.request<{ price: string }>('GET', '/verify/info'); }
  /** Provide exactly one of `to` (mobile) or `bot` ({id, ref}). */
  create(o: { to?: string; bot?: { id: Id; ref: string }; lineId?: Id | 'sandbox'; mode?: string; length?: number; ttlSec?: number; maxAttempts?: number; redirectUrl?: string; callbackUrl?: string; clientRef?: string; brandName?: string; brandColor?: string }) {
    return this.t.request<Json>('POST', '/verify/sessions', { body: { ...o, lineId: o.lineId === undefined ? undefined : String(o.lineId), bot: o.bot && { id: String(o.bot.id), ref: o.bot.ref } } });
  }
  list(o: { take?: number; before?: Id } = {}) { return this.t.request<Json[]>('GET', '/verify/sessions', { query: page(o.take, o.before) }); }
  get(id: Id) { return this.t.request<Json>('GET', `/verify/sessions/${e(id)}`); }
  async cancel(id: Id) { await this.t.request('POST', `/verify/sessions/${e(id)}/cancel`); }
  stats() { return this.t.request<Json>('GET', '/verify/stats'); }
}

/** Bot builder. Creating/configuring bots is panel-only. `to`/`message` follow the panel's bot sender shapes. */
export class Bots {
  constructor(private t: Transport) {}
  info() { return this.t.request<Json>('GET', '/botbuilder/info'); }
  list() { return this.t.request<Json[]>('GET', '/botbuilder/bots'); }
  get(botId: Id) { return this.t.request<Json>('GET', `/botbuilder/bots/${e(botId)}`); }
  stats(botId: Id) { return this.t.request<Json>('GET', `/botbuilder/bots/${e(botId)}/stats`); }
  subscribers(botId: Id, o: { take?: number; before?: Id } = {}) { return this.t.request<Json[]>('GET', `/botbuilder/bots/${e(botId)}/subscribers`, { query: page(o.take, o.before) }); }
  messages(botId: Id, o: { take?: number; before?: Id } = {}) { return this.t.request<Json[]>('GET', `/botbuilder/bots/${e(botId)}/messages`, { query: page(o.take, o.before) }); }
  /** HTTP 202, queued. */
  send(botId: Id, to: Json, message: Json, idempotencyKey?: string) { return this.t.request<Json>('POST', `/botbuilder/bots/${e(botId)}/send`, { body: { to, message }, headers: idem(idempotencyKey) }); }
  otp(botId: Id, to: Json, o: { length?: number; template?: string; idempotencyKey?: string } = {}) {
    return this.t.request<Json>('POST', `/botbuilder/bots/${e(botId)}/otp`, { body: { to, length: o.length, template: o.template }, headers: idem(o.idempotencyKey) });
  }
  shopOrders(botId: Id, status?: 'new' | 'confirmed' | 'shipped' | 'done' | 'canceled') { return this.t.request<Json[]>('GET', `/botbuilder/bots/${e(botId)}/shop/orders`, { query: { status } }); }
  shopStats(botId: Id) { return this.t.request<Json>('GET', `/botbuilder/bots/${e(botId)}/shop/stats`); }
}

export interface BrokerUpdatesOptions { offset?: number; limit?: number; timeout?: number; allowedUpdates?: string[] }
export interface BrokerWebhookOptions { url: string; secretToken?: string; allowedUpdates?: string[]; dropPendingUpdates?: boolean }

/** Telegram broker: register a bot token, get a private relay link, call the Bot API and pull updates through it. */
export class Broker {
  constructor(private t: Transport) {}
  /** Scope `broker.read`. */
  list() { return this.t.request<Json[]>('GET', '/broker/bots'); }
  get(id: Id) { return this.t.request<Json>('GET', `/broker/bots/${e(id)}`); }
  /** Scope `broker.write`, account owner only. The token is never returned afterwards; the response carries the relay `link`. */
  create(label: string, token: string) { return this.t.request<Json>('POST', '/broker/bots', { body: { label, token } }); }
  async rename(id: Id, label: string) { await this.t.request('PATCH', `/broker/bots/${e(id)}`, { body: { label } }); }
  /** Swap in a regenerated BotFather token. Clears the return webhook. */
  replaceToken(id: Id, token: string) { return this.t.request<Json>('PUT', `/broker/bots/${e(id)}/token`, { body: { token } }); }
  /** New relay link; the previous one stops working. */
  rotate(id: Id) { return this.t.request<Json>('POST', `/broker/bots/${e(id)}/rotate`); }
  async delete(id: Id) { await this.t.request('DELETE', `/broker/bots/${e(id)}`); }
  /** Scope `broker.request`: call any Telegram Bot API method, e.g. `request(1, 'sendMessage', { chat_id, text })`. */
  request(id: Id, method: string, params: Json = {}) { return this.t.request<{ status: number; response: unknown }>('POST', `/broker/bots/${e(id)}/request`, { body: { method, params } }); }
  /** Scope `broker.request`: pull updates (long-poll `timeout` ≤ 25 s). */
  updates(id: Id, o: BrokerUpdatesOptions = {}) { return this.t.request<{ status: number; response: unknown }>('POST', `/broker/bots/${e(id)}/updates`, { body: o }); }
  webhook(id: Id) { return this.t.request<Json>('GET', `/broker/bots/${e(id)}/webhook`); }
  setWebhook(id: Id, o: BrokerWebhookOptions) { return this.t.request<Json>('PUT', `/broker/bots/${e(id)}/webhook`, { body: o }); }
  deleteWebhook(id: Id, dropPendingUpdates?: boolean) { return this.t.request<Json>('DELETE', `/broker/bots/${e(id)}/webhook`, { body: { dropPendingUpdates } }); }
}

export class Voip {
  constructor(private t: Transport) {}
  calls() { return this.t.request<Json[]>('GET', '/voip/calls'); }
  price() { return this.t.request<Json>('GET', '/voip/price'); }
  call(from: string, to: string) { return this.t.request<Json>('POST', '/voip/calls', { body: { from, to } }); }
}
