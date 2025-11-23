import { Response } from "express";

export const successHandler = ({
  res,
  message = "Done",
  status = 200,
  result = {},
}: {
  res: Response;
  message?: string;
  status?: number;
  result?: Object | null;
}): Response => {
  return res.status(status).json({ message, status, result });
};

export const successHandlerGraphQL = ({
  message = "Done",
  status = 200,
  result = {},
}: {
  message?: string;
  status?: number;
  result?: Object | null;
}): Object => {
  return { message, status, result };
};
