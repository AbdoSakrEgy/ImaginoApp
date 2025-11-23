"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successHandlerGraphQL = exports.successHandler = void 0;
const successHandler = ({ res, message = "Done", status = 200, result = {}, }) => {
    return res.status(status).json({ message, status, result });
};
exports.successHandler = successHandler;
const successHandlerGraphQL = ({ message = "Done", status = 200, result = {}, }) => {
    return { message, status, result };
};
exports.successHandlerGraphQL = successHandlerGraphQL;
