"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotValidEmail = exports.ValidationError = exports.ApplicationExpection = void 0;
class ApplicationExpection extends Error {
    statusCode;
    constructor(msg, statusCode, options) {
        super(msg, options);
        this.statusCode = statusCode;
    }
}
exports.ApplicationExpection = ApplicationExpection;
class ValidationError extends ApplicationExpection {
    constructor(msg, statusCode) {
        super(msg, statusCode);
    }
}
exports.ValidationError = ValidationError;
class NotValidEmail extends ApplicationExpection {
    constructor(msg = "Not valid email", statusCode = 400) {
        super(msg, statusCode);
    }
}
exports.NotValidEmail = NotValidEmail;
