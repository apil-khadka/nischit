export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = "DOMAIN_ERROR",
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class PaymentOutcomeUnknownError extends DomainError {
  constructor(message = "Payment submission outcome is unknown and must be reconciled before retrying") {
    super(message, "PAYMENT_OUTCOME_UNKNOWN", 503);
    this.name = "PaymentOutcomeUnknownError";
  }
}

export class PaymentNotSubmittedError extends DomainError {
  constructor(message = "No payment transaction was submitted; retry is safe") {
    super(message, "PAYMENT_NOT_SUBMITTED", 503);
    this.name = "PaymentNotSubmittedError";
  }
}

export const forbidden = (message = "Action is not allowed") =>
  new DomainError(message, "FORBIDDEN", 403);
export const notFound = (message = "Resource not found") =>
  new DomainError(message, "NOT_FOUND", 404);
export const conflict = (message: string) => new DomainError(message, "CONFLICT", 409);
