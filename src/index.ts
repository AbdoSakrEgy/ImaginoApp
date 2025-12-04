import path from "path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve("./src/config/.env"),
});

import { bootstrap } from "./bootstrap";

// For local development
if (process.env.NODE_ENV !== "lambda") {
  bootstrap().catch((err) => {
    console.error("Failed to bootstrap server:", err);
    process.exit(1);
  });
}

// For serverless/Lambda environments
export const handler = async (event: any, context: any) => {
  try {
    await bootstrap();
    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Server initialized" }),
    };
  } catch (error) {
    console.error("Handler error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
