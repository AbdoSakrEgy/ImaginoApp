import { NextFunction } from "express";
import { UserModel } from "../modules/user/user.model.js";
import { MyJwtPayload, verifyJwt } from "./jwt.js";
import { ApplicationExpection } from "./Errors.js";
import { HydratedDocument } from "mongoose";
import { IUser } from "../types/user.module.types.js";

export enum tokenTypes {
  access = "access",
  refresh = "refresh",
}

const userModel = UserModel;

export const decodeToken = async ({
  authorization,
  tokenType = tokenTypes.access,
}: {
  authorization: string;
  tokenType?: tokenTypes;
}): Promise<{ user: HydratedDocument<IUser>; payload: MyJwtPayload }> => {
  // step: bearer key
  if (!authorization.startsWith(process.env.BEARER_KEY as string)) {
    throw new ApplicationExpection("Invalid bearer key", 400);
  }
  // step: token validation
  let [bearer, token] = authorization.split(" ");
  // step: check authorization existence
  if (!token) {
    throw new ApplicationExpection("Invalid authorization", 400);
  }
  let privateKey = "";
  if (tokenType == tokenTypes.access) {
    privateKey = process.env.ACCESS_SEGNATURE as string;
  } else if (tokenType == tokenTypes.refresh) {
    privateKey = process.env.REFRESH_SEGNATURE as string;
  }
  let payload = verifyJwt({ token, privateKey }); // result || error
  // step: user existence
  const user = await userModel.findOne({ filter: { _id: payload.userId } });
  if (!user) {
    throw new ApplicationExpection("User not found", 404);
  }
  // step: credentials changing
  if (user.credentialsChangedAt) {
    if (user.credentialsChangedAt.getTime() > payload.iat * 1000) {
      throw new ApplicationExpection("You have to login", 400);
    }
  }
  // step: return user & payload
  return { user, payload };
};
