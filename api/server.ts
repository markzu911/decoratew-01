// Vercel Serverless entry point.
// Re-export the Express app built in ../server.ts.
// On Vercel, NODE_ENV=production and process.env.VERCEL=true, so the local
// Vite-middleware and listen() branches in ../server.ts are never executed.
import app from "../server";

export default app;
