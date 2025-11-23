import { NextFunction, Request, Response } from "express";
import { ZodObject } from "zod";
import { ValidationError } from "../utils/Errors";

export const validation = (shcema: ZodObject) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = {
      ...req.body,
      ...req.params,
      ...req.query,
      // express.json() can't see or parssing fields that has files, so we create this field and put data in it manually
      // profileImage: req.file,
      // attachment: req.file,
      // attachments: req.files,
    };
    const result = shcema.safeParse(data);
    if (!result.success) {
      const issues = result.error?.issues;
      let messages = "";
      for (let item of issues) {
        messages += item.message + " ||&&|| ";
      }
      throw new ValidationError(messages, 400);
    }
    next();
  };
};
