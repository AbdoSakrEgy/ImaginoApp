import { NextFunction } from "express";
import { UserModel } from "../modules/user/user.model.js";
import { MyJwtPayload, verifyJwt } from "./jwt.js";
import { ApplicationException } from "./Errors.js";
import { HydratedDocument } from "mongoose";
import { IUser } from "../types/user.module.types.js";

export enum TokenTypesEnum {
  access = "access",
  refresh = "refresh",
}

const userModel = UserModel;

export const decodeToken = async ({
  authorization,
  tokenType = TokenTypesEnum.access,
}: {
  authorization: string;
  tokenType?: TokenTypesEnum;
}): Promise<{ user: HydratedDocument<IUser>; payload: MyJwtPayload }> => {
  // step: bearer key
  if (!authorization.startsWith(process.env.BEARER_KEY as string)) {
    throw new ApplicationException("Invalid bearer key", 400);
  }
  // step: token validation
  let [bearer, token] = authorization.split(" ");
  // step: check authorization existence
  if (!token || token == null) {
    throw new ApplicationException("Invalid authorization", 400);
  }
  let privateKey = "";
  if (tokenType == TokenTypesEnum.access) {
    privateKey = process.env.ACCESS_SEGNATURE as string;
  } else if (tokenType == TokenTypesEnum.refresh) {
    privateKey = process.env.REFRESH_SEGNATURE as string;
  }
  let payload = verifyJwt({ token, privateKey }); // result || error
  // step: user existence
  const user = await userModel.findOne({ _id: payload.userId });
  if (!user) {
    throw new ApplicationException("User not found", 404);
  }
  // step: credentials changing
  if (user.credentialsChangedAt) {
    if (user.credentialsChangedAt.getTime() > payload.iat * 1000) {
      throw new ApplicationException("You have to login", 400);
    }
  }
  // step: return user & payload
  return { user, payload };
};
