import { createApp } from '../server.js';

// Runs the Express app in server.ts as one Vercel serverless function that handles every /api/*
// request (see vercel.json). The app is created once per warm instance and reused.
let cachedApp: ReturnType<typeof createApp> | null = null;

export default async function handler(req: any, res: any) {
  if (!cachedApp) cachedApp = createApp();
  const app = await cachedApp;
  return (app as any)(req, res);
}
