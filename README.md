# @irnoti/sdk

[![npm](https://img.shields.io/npm/v/@irnoti/sdk.svg)](https://www.npmjs.com/package/@irnoti/sdk) [![tests](https://github.com/irnoti/node-sms-panel-api/actions/workflows/tests.yml/badge.svg)](https://github.com/irnoti/node-sms-panel-api/actions/workflows/tests.yml) [![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.md)

Node.js / TypeScript SDK for the irnoti API. Zero dependencies, ESM, fully typed.

```bash
npm install @irnoti/sdk
```

```ts
import { Irnoti, IrnotiApiError, parseWebhook } from '@irnoti/sdk';

const irnoti = new Irnoti({ apiKey: process.env.IRNOTI_API_KEY! }); // baseUrl, timeoutMs, retries, fetch are optional

try {
  const [line] = await irnoti.lines.list();
  await irnoti.sms.quote({ lineId: line.id, to: '09121234567', text: 'Hi' });          // { count, parts, totalPrice }
  await irnoti.sms.send({ lineId: line.id, to: ['09121234567'], groupIds: [12], text: 'Hi', idempotencyKey: 'k1' });
  await irnoti.sms.send({ lineId: line.id, groupIds: [12], text: 'Drip', gradual: { chunkSize: 500, intervalMinutes: 10 } });
  await irnoti.sms.pattern('k3f9a2', '09121234567', { code: '4821' });
  await irnoti.services.create('regional', { province: 'tehran', count: 5000, text: 'Sale' });
} catch (e) {
  if (e instanceof IrnotiApiError && e.isInsufficientBalance) { /* top up */ }
  else throw e;
}

// Express: use the raw body
app.post('/irnoti/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const event = parseWebhook(req.body, req.header('X-Irnoti-Signature') ?? '', process.env.IRNOTI_WEBHOOK_SECRET!);
  res.sendStatus(204);
});
```

Multi-tenant: `irnoti.withApiKey(customerKey)` returns an independent client.

### Telegram broker

```ts
const bot = await irnoti.broker.create('Shop bot', botFatherToken);   // scope broker.write (account owner); returns the relay `link`
await irnoti.broker.request(bot.id, 'sendMessage', { chat_id: 123, text: 'Hi' }); // scope broker.request
await irnoti.broker.updates(bot.id, { limit: 20 });                    // pull mode
await irnoti.broker.setWebhook(bot.id, { url: 'https://example.com/tg', secretToken: 's3cret' }); // push mode
```

## Behaviour shared by all irnoti SDKs

- **Auth:** `Authorization: Bearer irn_live_…`. Use an `irn_test_…` key with `lineId: "sandbox"` to try sends for free. Keys carry scopes (`sms.send`, `sms.read`, `wallet.read`, `phonebook.read|write`, `bot.send|read`, `broker.read|write|request`, `verify.send|read`); a missing scope is a `403`.
- **Money** is integer **Rial** returned as a **string** (`"1960"`) — never parse it into a float.
- **Idempotency:** every send takes an idempotency key; retrying with the same key never sends twice (`replayed: true`). Automatic retries apply only to `GET`s and sends that carry a key.
- **Errors:** one error type carrying `status`, the API's machine `code` (`insufficient_balance`, `invalid_recipients`, `no_price`, … — empty for plain 401/403/404) and `details`, with helpers such as `isInsufficientBalance` / `isRateLimited` / `isUnauthenticated`.
- **Limits:** send 600 req/min, pattern 1200 req/min per IP (`429` when exceeded).
- **Webhooks:** verify the **raw** body against `X-Irnoti-Signature: t=<unix>,v1=<hex>` (HMAC-SHA256 of `"<t>.<body>"` with your `whsec_…` key); signatures older than 5 minutes are rejected.
- Bot-builder creation/configuration and verify settings are panel-only; Telegram broker bots can be managed through the API.

Sibling SDKs: [Laravel](https://github.com/irnoti/laravel-sms-panel-api) · [Node.js](https://github.com/irnoti/node-sms-panel-api) · [Python](https://github.com/irnoti/python-sms-panel-api) · [Go](https://github.com/irnoti/go-sms-panel-api) · [PHP](https://github.com/irnoti/php-sms-panel-api). API reference: [irnoti.com/docs](https://irnoti.com/docs).

MIT licensed.
