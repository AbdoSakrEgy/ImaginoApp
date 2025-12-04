import { NextFunction, Request, Response } from "express";
import { ZodObject } from "zod";
import { ValidationError } from "../utils/Errors";

export const validation = (shcema: ZodObject) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = {
      ...req.body,
      ...req.params,
      ...req.query,
      // express.json() cannot parse multipart/form-data (file uploads),
      // so we manually attach uploaded file(s) to the data object
      // to allow Zod to validate them.
      profileImage: req.file,
      attachment: req.file,
      attachments: req.files,
    };
    const result = shcema.safeParse(data);
    if (!result.success) {
      const issues = result.error?.issues;
      let messages = "";
      for (let item of issues) {
        messages += String(item.path[0]) + " => " + item.message + "   ||&&||   ";
      }
      throw new ValidationError(messages, 400);
    }
    next();
  };
};
