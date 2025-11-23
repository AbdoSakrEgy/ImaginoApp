"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyJwt = exports.createJwt = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const createJwt = (payload, privateKey, options) => {
    const token = (0, jsonwebtoken_1.sign)(payload, privateKey, options);
    return token;
};
exports.createJwt = createJwt;
const verifyJwt = ({ token, privateKey, }) => {
    const payload = (0, jsonwebtoken_1.verify)(token, privateKey); // result || error
    return payload;
};
exports.verifyJwt = verifyJwt;
