/** Thrown for every non-2xx answer. `code` is the API's machine-readable code ('' for plain 401/403/404). */
export class IrnotiApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    /** Invalid numbers, missing template params or per-field validation errors. */
    readonly details: unknown = undefined,
  ) {
    super(message);
    this.name = 'IrnotiApiError';
  }
  get isValidationError() { return ['validation_error', 'invalid_recipients', 'missing_params'].includes(this.code); }
  get isInvalidRecipients() { return this.code === 'invalid_recipients'; }
  get isInsufficientBalance() { return this.status === 402 || this.code === 'insufficient_balance'; }
  get isNoPrice() { return this.code === 'no_price'; }
  get isRateLimited() { return this.status === 429; }
  get isUnauthenticated() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isNotFound() { return this.status === 404; }
  get isConflict() { return this.status === 409; }
  get isServerError() { return this.status >= 500; }
}
