
// bootstrap.ts
import express, { NextFunction, Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve("./src/config/.env"),
});

import router from "./routes";
import { connectDB } from "./DB/db.connection";
import { ApplicationException, IError } from "./utils/Errors";
import cors from "cors";
import { rateLimit } from "express-rate-limit";

const whitelist = ["http://example1.com", "http://example2.com", "http://127.0.0.1:5501", undefined];
const corsOptions = {
  origin: function (origin: any, callback: any) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new ApplicationException("Not allowed by CORS", 401));
    }
  },
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  ipv6Subnet: 56,
});

let app: express.Application;

export const bootstrap = async () => {
  await connectDB();
  
  app = express();
  app.use(cors(corsOptions));
  app.use(limiter);
  app.use(express.json());
  app.use("/api/v1", router);

  app.use((err: IError, req: Request, res: Response, next: NextFunction) => {
    res.status(err.statusCode || 500).json({
      errMsg: err.message,
      status: err.statusCode || 500,
      stack: err.stack,
    });
  });

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      errMsg: "Route Not Found",
      status: 404,
    });
  });

  const httpServer = app.listen(process.env.PORT || 3000, () => {
    console.log("Backend server is running on port", process.env.PORT);
    console.log("=========================================");
  });

  return httpServer;
};

export const getApp = () => app;