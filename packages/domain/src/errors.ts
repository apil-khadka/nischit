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

export const forbidden = (message = "Action is not allowed") =>
  new DomainError(message, "FORBIDDEN", 403);
export const notFound = (message = "Resource not found") =>
  new DomainError(message, "NOT_FOUND", 404);
export const conflict = (message: string) => new DomainError(message, "CONFLICT", 409);
