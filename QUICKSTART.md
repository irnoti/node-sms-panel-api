# Quickstart (Node.js / TypeScript)

Goal: send your first SMS with the irnoti Node.js / TypeScript SDK in about 5 minutes, without spending money.

Full function list: [README → function reference](README.md#what-can-this-sdk-do-function-reference). Full API reference (the docs panel): [irnoti.com/docs](https://irnoti.com/docs).

## 1. Install

```bash
npm install @irnoti/sdk
```

Requires Node.js 18+ (ESM; types included).

## 2. Get an access key

In the irnoti panel create an **access key** (docs panel → *Authentication / Access keys*).

- `irn_test_…` — sandbox key: nothing is sent, nothing is charged. **Start with this.**
- `irn_live_…` — real key: sends real SMS and charges your wallet.

Keep it in an environment variable, never in source control or client-side code:

```bash
export IRNOTI_API_KEY=irn_test_xxxxxxxx
```

## 3. Send a test SMS (sandbox, free)

```ts
import { Irnoti, IrnotiApiError } from '@irnoti/sdk';

const irnoti = new Irnoti({ apiKey: process.env.IRNOTI_API_KEY! });

try {
  // How much would it cost? (no send, no charge)
  console.log(await irnoti.sms.quote({ lineId: 'sandbox', to: '09121234567', text: 'Hello' }));

  // Send. idempotencyKey makes retries safe: the same key never sends twice.
  const result = await irnoti.sms.send({ lineId: 'sandbox', to: '09121234567', text: 'Hello', idempotencyKey: 'my-first-send' });
  console.log(result); // { batchId, count: 1, totalPrice: '…', replayed: false }
} catch (e) {
  if (e instanceof IrnotiApiError) console.error(e.status, e.code, e.message);
  else throw e;
}
```

`totalPrice` is an integer amount in **Rial, returned as a string** — don't convert it to a float.

## 4. Go live

1. Switch to an `irn_live_…` key.
2. Find your sender number: list your lines and use its `id` instead of `"sandbox"`.
3. Check money: the wallet `balance` function.
4. Always `quote` first for big sends, and always pass an idempotency key to `send`.

```ts
const [line] = await irnoti.lines.list();
await irnoti.sms.send({ lineId: line.id, to: ['09121234567'], text: 'Hello', idempotencyKey: 'order-1001' });
```

## 5. Common tasks — which function, which docs section

| I want to… | Call | Docs section |
|---|---|---|
| Send one/many SMS | `irnoti.sms.send({ lineId, text, to: [...] })` | SMS |
| Send to a contact group | `irnoti.sms.send({ lineId, text, groupIds: [12] })` | SMS + Phonebook |
| Schedule / drip-send | `irnoti.sms.send({ ..., scheduledAt, gradual: { chunkSize: 500, intervalMinutes: 10 } })` | SMS |
| Send an OTP with an approved template | `irnoti.sms.pattern('template_code', '0912…', { code: '4821' })` | SMS → Pattern |
| Check delivery | `irnoti.messages.get(id)` or a webhook | SMS → Messages / Webhooks |
| Manage contacts | `irnoti.phonebook.createGroup(...)`, `addContacts(...)`, `importCsv(...)` | Phonebook |
| Check balance | `irnoti.wallet.balance()` | Wallet |
| Phone verification flow | `irnoti.verify.create({ to: '0912…', ttlSec: 300 })` | Verify |
| Telegram bot relay | `irnoti.broker.create(label, token)` | Telegram broker |

(Every function: [README reference table](README.md#what-can-this-sdk-do-function-reference).)

## 6. Handle errors

```ts
try {
  await irnoti.sms.send({ lineId, to: '0912…', text: 'Hi' });
} catch (e) {
  if (!(e instanceof IrnotiApiError)) throw e;
  if (e.isInsufficientBalance) { /* top up the wallet */ }
  else if (e.isRateLimited) { /* slow down */ }
  else if (e.isInvalidRecipients) console.log(e.details);
  else throw e;
}
```

Status → helper: `401` unauthenticated, `402` insufficient balance, `403` forbidden (missing scope / KYC), `404` not found, `422` `no_price`, `429` rate limited (send limit 600 req/min).

## 7. Receive delivery webhooks

Verify the **raw** request body (not re-serialised JSON) against the `X-Irnoti-Signature` header with your `whsec_…` secret. Signatures older than 5 minutes are rejected; events can repeat, so de-duplicate on `X-Irnoti-Delivery`.

```ts
// Express: use express.raw so you get the untouched body
import express from 'express';
import { parseWebhook } from '@irnoti/sdk';

app.post('/irnoti/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = parseWebhook(req.body, req.header('X-Irnoti-Signature') ?? '', process.env.IRNOTI_WEBHOOK_SECRET!);
    console.log(event.event, event.data);
    res.sendStatus(204);
  } catch {
    res.sendStatus(400);
  }
});
```

## Next

- Browse everything in the [function reference](README.md#what-can-this-sdk-do-function-reference).
- Your editor shows each function's arguments from the bundled TypeScript types.
- Multi-tenant app? `irnoti.withApiKey(customerKey)`.
