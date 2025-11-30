import { NextFunction, Request, Response } from "express";
import { decodeToken, TokenTypesEnum } from "../utils/decodeToken.js";
import { ApplicationException } from "../utils/Errors.js";

export const auth = async (
  req: Request | any,
  res: Response,
  next: NextFunction
) => {
  // step: check authorization
  const { authorization } = req.headers;
  if (!authorization) {
    throw new ApplicationException("Authorization is required", 400);
  }
  const { user, payload } = await decodeToken({
    authorization,
    tokenType: TokenTypesEnum.access,
  });
  // step: modify res.locals
  res.locals.user = user;
  res.locals.payload = payload;
  // step: modify req for multer.local.upload
  req.user = user;
  return next();
};
