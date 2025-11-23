import bcrypt from "bcrypt";

export const hash = async (plainText: string): Promise<string> => {
  return await bcrypt.hash(plainText, Number(process.env.SALAT));
};

export const compare = async (
  plainText: string,
  hashedText: string
): Promise<boolean> => {
  return await bcrypt.compare(plainText, hashedText);
};
