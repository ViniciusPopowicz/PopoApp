export class DomainError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends DomainError {
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message, 400);
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Não autorizado') {
    super(message, 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Acesso proibido') {
    super(message, 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Registro não encontrado') {
    super(message, 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Conflito de dados') {
    super(message, 409);
  }
}
