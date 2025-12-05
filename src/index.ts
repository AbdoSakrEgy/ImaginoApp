import dotenv from "dotenv";
dotenv.config({ path: "./src/.env" });
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import router from "./routes";
import { ApplicationException, IError } from "./utils/Errors";
import { connectDB } from "./DB/db.connection";

const app = express();

let whitelist = ["http://example1.com", "http://example2.com", "http://127.0.0.1:5501", undefined];
let corsOptions = {
  origin: function (origin: any, callback: any) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new ApplicationException("Not allowed by CORS", 401));
    }
  },
};

app.use(express.json());

// Connect DB before setting up routes
let dbConnected = false;

app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (!dbConnected) {
    try {
      await connectDB();
      dbConnected = true;
      console.log("DB connected");
    } catch (err) {
      console.error("DB connection failed:", err);
      return res.status(500).json({
        errMsg: "Database connection failed",
        status: 500,
      });
    }
  }
  next();
});

app.use("/api/v1", router);

// Global error handler
app.use((err: IError, req: Request, res: Response, next: NextFunction) => {
  res.status(err.statusCode || 500).json({
    errMsg: err.message,
    status: err.statusCode || 500,
    stack: err.stack,
  });
});

// Local dev only
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const startServer = async () => {
    try {
      await connectDB();
      console.log("DB connected, starting server...");
      app.listen(3000, () => {
        console.log("Server running on port 3000");
      });
    } catch (err) {
      console.error("Failed to start server:", err);
      process.exit(1);
    }
  };
  startServer();
}

export default app;
