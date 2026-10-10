import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookEvent } from './types.js';

/**
 * Verifies `X-Irnoti-Signature: t=<unix>,v1=<hex>` — HMAC-SHA256 of `"<t>.<raw body>"` with your `whsec_…` key.
 * Pass the RAW request body (string/Buffer), never the re-serialised JSON.
 */
export function verifyWebhook(rawBody: string | Buffer, signatureHeader: string, secret: string, toleranceSec = 300): boolean {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(signatureHeader);
  if (!m) return false;
  if (Math.abs(Date.now() / 1000 - Number(m[1])) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${m[1]}.`).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(m[2], 'hex'));
}

/** Verify and decode in one step; throws on a bad signature. */
export function parseWebhook(rawBody: string | Buffer, signatureHeader: string, secret: string, toleranceSec = 300): WebhookEvent {
  if (!verifyWebhook(rawBody, signatureHeader, secret, toleranceSec)) throw new Error('Invalid irnoti webhook signature');
  return JSON.parse(rawBody.toString()) as WebhookEvent;
}
