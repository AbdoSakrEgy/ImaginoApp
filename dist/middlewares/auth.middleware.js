"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
const decodeToken_js_1 = require("../utils/decodeToken.js");
const Errors_js_1 = require("../utils/Errors.js");
const auth = async (req, res, next) => {
    // step: check authorization
    const { authorization } = req.headers;
    if (!authorization) {
        throw new Errors_js_1.ApplicationException("Authorization is required", 400);
    }
    const { user, payload } = await (0, decodeToken_js_1.decodeToken)({
        authorization,
        tokenType: decodeToken_js_1.TokenTypesEnum.access,
    });
    // step: modify res.locals
    res.locals.user = user;
    res.locals.payload = payload;
    // step: modify req for multer.local.upload
    req.user = user;
    return next();
};
exports.auth = auth;
