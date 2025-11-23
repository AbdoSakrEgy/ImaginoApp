import { NextFunction, Request, Response } from "express";
import { decodeToken, tokenTypes } from "../utils/decodeToken.js";
import { ApplicationExpection } from "../utils/Errors.js";

export const auth = async (
  req: Request | any,
  res: Response,
  next: NextFunction
) => {
  // step: check authorization
  const { authorization } = req.headers;
  if (!authorization) {
    throw new ApplicationExpection("Authorization is required", 400);
  }
  const { user, payload } = await decodeToken({
    authorization,
    tokenType: tokenTypes.access,
  });
  // step: modify res.locals
  res.locals.user = user;
  res.locals.payload = payload;
  // step: modify req for multer.local.upload
  req.user = user;
  return next();
};
