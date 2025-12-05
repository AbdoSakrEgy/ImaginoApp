import express, { NextFunction, Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import router from "./routes";
import { ApplicationException, IError } from "./utils/Errors";
import cors from "cors";
import { connectDB } from "./DB/db.connection";

dotenv.config({
  path: path.resolve("./src/config/.env"),
});

const app = express();

// Middleware
var whitelist = [
  "http://example1.com",
  "http://example2.com",
  "http://127.0.0.1:5501",
  undefined,
];

var corsOptions = {
  origin: function (origin: any, callback: any) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new ApplicationException("Not allowed by CORS", 401));
    }
  },
};

app.use(cors(corsOptions));
app.use(express.json());
app.use("/api/v1", router);

// Global error handler
app.use((err: IError, req: Request, res: Response, next: NextFunction) => {
  res.status(err.statusCode || 500).json({
    errMsg: err.message,
    status: err.statusCode || 500,
    stack: err.stack,
  });
});

// Wrap server start in an async function
const startServer = async () => {
  try {
    await connectDB(); // ✅ wait for DB connection
    console.log("DB connected, starting server...");

    app.listen(3000, () => {
      console.log("Server running on port 3000");
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1); // Stop server if DB fails
  }
};

startServer();

export default app;
