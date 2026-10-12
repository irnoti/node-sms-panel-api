import { Transport, type ClientOptions } from './client.js';
import { Batches, Bots, Broker, Lines, LinkTracker, Messages, NumberBanks, Phonebook, Services, Sms, Verify, Voip, Wallet } from './resources.js';

export class Irnoti {
  readonly sms: Sms;
  readonly messages: Messages;
  readonly batches: Batches;
  readonly lines: Lines;
  readonly wallet: Wallet;
  readonly phonebook: Phonebook;
  readonly services: Services;
  readonly linkTracker: LinkTracker;
  readonly numberBanks: NumberBanks;
  readonly verify: Verify;
  readonly bots: Bots;
  readonly broker: Broker;
  readonly voip: Voip;

  constructor(private readonly options: ClientOptions) {
    const t = new Transport(options);
    this.sms = new Sms(t);
    this.messages = new Messages(t);
    this.batches = new Batches(t);
    this.lines = new Lines(t);
    this.wallet = new Wallet(t);
    this.phonebook = new Phonebook(t);
    this.services = new Services(t);
    this.linkTracker = new LinkTracker(t);
    this.numberBanks = new NumberBanks(t);
    this.verify = new Verify(t);
    this.bots = new Bots(t);
    this.broker = new Broker(t);
    this.voip = new Voip(t);
  }

  /** A new independent client bound to another key (multi-tenant apps). */
  withApiKey(apiKey: string) { return new Irnoti({ ...this.options, apiKey }); }
}

export { IrnotiApiError } from './errors.js';
export { verifyWebhook, parseWebhook } from './webhook.js';
export type { ClientOptions } from './client.js';
export type { BrokerUpdatesOptions, BrokerWebhookOptions } from './resources.js';
export * from './types.js';
