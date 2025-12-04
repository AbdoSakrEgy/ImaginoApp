// src/index.ts
import express, { NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import { rateLimit } from "express-rate-limit";

// Load env variables from .env.local (Vercel uses this in production)
dotenv.config();

import router from "./routes";
import { connectDB } from "./DB/db.connection";
import { ApplicationException, IError } from "./utils/Errors";

const app = express();

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

// Middleware
app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json());

// Routes
app.use("/api/v1", router);

// Error handling middleware
app.use((err: IError, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err);
  res.status(err.statusCode || 500).json({
    errMsg: err.message,
    status: err.statusCode || 500,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    errMsg: "Route Not Found",
    status: 404,
  });
});

// Initialize database and start server for local development
if (process.env.NODE_ENV !== "serverless") {
  connectDB().then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Backend server is running on port ${PORT}`);
      console.log("=========================================");
    });
  }).catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });
}

export default app;