/** Money is integer Rial encoded as a string; never parse it into a float. */
export type Rial = string;
export type Id = string | number;

export interface BatchResult { batchId: string; count: number; totalPrice: Rial; replayed: boolean }
export interface Quote { count: number; parts: number; totalPrice: Rial }
export interface Line { id: string; number: string; kind: 'shared' | 'dedicated' | string }
export interface Message {
  id: string; kind: string; to: string; body: string; parts: number; totalPrice: Rial;
  status: 'queued' | 'sent' | 'delivered' | 'failed'; error: string | null; sandbox: boolean;
  createdAt: string; sentAt: string | null; deliveredAt: string | null;
}
export interface Group { id: string; name: string; contacts: number; createdAt: string }
export interface ContactInput {
  mobile: string; name?: string; lastName?: string; company?: string; email?: string;
  city?: string; note?: string; birth?: string; fields?: Record<string, string>;
}
export interface AddContactsResult { added: number; duplicates: number; invalid: number }

export interface SendOptions {
  lineId: Id | 'sandbox';
  text: string;
  to?: string | string[];
  groupIds?: Id[];
  /** 1 minute – 60 days ahead. */
  scheduledAt?: Date | string;
  /** Release `chunkSize` messages every `intervalMinutes`. */
  gradual?: { chunkSize: number; intervalMinutes: number };
  /** Retrying with the same key never sends twice. */
  idempotencyKey?: string;
}

export type ServiceProduct = 'regional' | 'targeted' | 'peyamap' | 'smart' | 'messenger' | 'voice' | 'international';

export interface WebhookEvent {
  id: string;
  event: 'message.sent' | 'message.delivered' | 'message.failed' | string;
  createdAt: string;
  data: Record<string, unknown>;
}
