import { customAlphabet } from "nanoid";

export const createOtp = () => {
  const otp = customAlphabet("0123456", 6)();
  return otp;
};
