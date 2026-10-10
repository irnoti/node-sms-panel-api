import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { Irnoti, IrnotiApiError, parseWebhook, verifyWebhook } from '../src/index.js';

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
function client(status = 200, payload: unknown = {}) {
  const calls: Call[] = [];
  const fetchStub = (async (url: URL, init: RequestInit) => {
    calls.push({ url: String(url), method: String(init.method), headers: init.headers as Record<string, string>, body: init.body });
    return new Response(status === 204 ? null : JSON.stringify(payload), { status });
  }) as unknown as typeof fetch;
  return { calls, api: new Irnoti({ apiKey: 'irn_test_x', baseUrl: 'https://irnoti.test/', fetch: fetchStub, retries: 0 }) };
}

test('send builds the request and returns the body', async () => {
  const { api, calls } = client(201, { batchId: '1', count: 2, totalPrice: '1960', replayed: false });
  const r = await api.sms.send({ lineId: 1, to: ['0912'], groupIds: [12], text: 'hi', scheduledAt: new Date('2026-10-20T09:00:00Z'), idempotencyKey: 'k1' });
  assert.equal(r.totalPrice, '1960');
  const c = calls[0];
  assert.equal(c.url, 'https://irnoti.test/v1/sms/send');
  assert.equal(c.headers.Authorization, 'Bearer irn_test_x');
  assert.equal(c.headers['Idempotency-Key'], 'k1');
  assert.deepEqual(JSON.parse(String(c.body)), { lineId: '1', to: ['0912'], groupIds: ['12'], text: 'hi', scheduledAt: '2026-10-20T09:00:00.000Z' });
});

test('query strings skip undefined values', async () => {
  const { api, calls } = client(200, []);
  await api.messages.list({ take: 2, before: 90 });
  assert.equal(calls[0].url, 'https://irnoti.test/v1/sms/messages?take=2&before=90');
  await api.bots.shopOrders(5);
  assert.equal(calls[1].url, 'https://irnoti.test/v1/botbuilder/bots/5/shop/orders');
});

test('errors carry status, code, details and helpers', async () => {
  const { api } = client(400, { statusCode: 400, code: 'invalid_recipients', details: ['0912'] });
  await assert.rejects(api.sms.send({ lineId: 1, to: '0912', text: 'x' }), (e: IrnotiApiError) => {
    assert.equal(e.status, 400);
    assert.equal(e.code, 'invalid_recipients');
    assert.deepEqual(e.details, ['0912']);
    assert.ok(e.isInvalidRecipients && e.isValidationError);
    return true;
  });
  const p = client(402, { statusCode: 402, code: 'insufficient_balance', message: ['Not', 'enough'] });
  await assert.rejects(p.api.wallet.balance(), (e: IrnotiApiError) => e.isInsufficientBalance && e.message === 'Not enough');
  const u = client(401, { statusCode: 401, message: 'Invalid API key' });
  await assert.rejects(u.api.lines.list(), (e: IrnotiApiError) => e.isUnauthenticated && e.code === '');
});

test('204 and CSV import', async () => {
  const { api, calls } = client(204);
  await api.batches.pause(7);
  assert.equal(calls[0].url, 'https://irnoti.test/v1/sms/batches/7/pause');
  const csv = client(200, { added: 1, duplicates: 0, invalid: 0 });
  await csv.api.phonebook.importCsv(12, '0912,Ali\n');
  assert.ok(csv.calls[0].body instanceof FormData);
  assert.equal(csv.calls[0].headers['Content-Type'], undefined);
});

test('withApiKey returns an independent client', async () => {
  const { api } = client();
  assert.notEqual(api.withApiKey('irn_live_y'), api);
});

test('webhook verification', () => {
  const body = '{"id":"1","event":"message.delivered","createdAt":"x","data":{}}';
  const sign = (t: number, b = body) => `t=${t},v1=${createHmac('sha256', 'whsec').update(`${t}.${b}`).digest('hex')}`;
  const now = Math.floor(Date.now() / 1000);
  assert.ok(verifyWebhook(body, sign(now), 'whsec'));
  assert.equal(parseWebhook(body, sign(now), 'whsec').event, 'message.delivered');
  assert.ok(!verifyWebhook(body + ' ', sign(now), 'whsec'));
  assert.ok(!verifyWebhook(body, sign(now - 3600), 'whsec'));
  assert.ok(!verifyWebhook(body, 'junk', 'whsec'));
  assert.throws(() => parseWebhook(body, 'junk', 'whsec'));
});
