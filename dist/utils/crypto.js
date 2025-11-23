"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = exports.encrypt = void 0;
const crypto_js_1 = __importDefault(require("crypto-js"));
const encrypt = (plainText) => {
    return crypto_js_1.default.AES.encrypt(plainText, process.env.PRIVATE_KEY).toString();
};
exports.encrypt = encrypt;
const decrypt = (cyphertext) => {
    return crypto_js_1.default.AES.decrypt(cyphertext, process.env.PRIVATE_KEY).toString(crypto_js_1.default.enc.Utf8);
};
exports.decrypt = decrypt;
