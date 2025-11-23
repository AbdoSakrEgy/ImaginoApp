"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOtp = void 0;
const nanoid_1 = require("nanoid");
const createOtp = () => {
    const otp = (0, nanoid_1.customAlphabet)("0123456", 6)();
    return otp;
};
exports.createOtp = createOtp;
