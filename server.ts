// Local development entry point.
// The actual Express app and API routes live in api/server.ts so Vercel can
// bundle the serverless function correctly. Importing it here runs the local
// Vite middleware and starts the HTTP listener when executed with `tsx server.ts`.
import app from "./api/server";

export default app;
