import app from "./bootstrap";

// For Vercel serverless, export as default handler
export default app;

// Also export as a named export for Vercel
export const handler = app;