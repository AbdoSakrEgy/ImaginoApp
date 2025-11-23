export interface IError extends Error {
  statusCode: number;
}

export class ApplicationExpection extends Error {
  statusCode: number;

  constructor(msg: string, statusCode: number, options?: ErrorOptions) {
    super(msg, options);
    this.statusCode = statusCode;
  }
}

export class ValidationError extends ApplicationExpection {
  constructor(msg: string, statusCode: number) {
    super(msg, statusCode);
  }
}

export class NotValidEmail extends ApplicationExpection {
  constructor(msg: string = "Not valid email", statusCode: number = 400) {
    super(msg, statusCode);
  }
}
