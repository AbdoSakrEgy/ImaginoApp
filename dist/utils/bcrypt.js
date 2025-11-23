"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compare = exports.hash = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const hash = async (plainText) => {
    return await bcrypt_1.default.hash(plainText, Number(process.env.SALAT));
};
exports.hash = hash;
const compare = async (plainText, hashedText) => {
    return await bcrypt_1.default.compare(plainText, hashedText);
};
exports.compare = compare;
