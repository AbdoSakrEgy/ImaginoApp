"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotValidEmail = exports.ValidationError = exports.ApplicationException = void 0;
class ApplicationException extends Error {
    statusCode;
    constructor(msg, statusCode, options) {
        super(msg, options);
        this.statusCode = statusCode;
    }
}
exports.ApplicationException = ApplicationException;
class ValidationError extends ApplicationException {
    constructor(msg, statusCode) {
        super(msg, statusCode);
    }
}
exports.ValidationError = ValidationError;
class NotValidEmail extends ApplicationException {
    constructor(msg = "Not valid email", statusCode = 400) {
        super(msg, statusCode);
    }
}
exports.NotValidEmail = NotValidEmail;
