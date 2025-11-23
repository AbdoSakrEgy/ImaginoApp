import CryptoJS from "crypto-js";

export const encrypt = (plainText: string) => {
  return CryptoJS.AES.encrypt(
    plainText,
    process.env.PRIVATE_KEY as string
  ).toString();
};
export const decrypt = (cyphertext: string) => {
  return CryptoJS.AES.decrypt(
    cyphertext,
    process.env.PRIVATE_KEY as string
  ).toString(CryptoJS.enc.Utf8);
};
