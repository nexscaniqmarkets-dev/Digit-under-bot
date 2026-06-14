import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { bot } from "./server-bot";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON requests
  app.use(express.json());

  // 1. Get bot state
  app.get("/api/bot/state", (req, res) => {
    res.json(bot.getFullState());
  });

  // Auth: Login with Deriv API Token
  app.post("/api/auth/login", async (req, res) => {
    const { token } = req.body;
    const result = await bot.loginWithToken(token);
    res.json({ ...result, state: bot.getFullState() });
  });

  // Auth: Logout
  app.post("/api/auth/logout", (req, res) => {
    const result = bot.logout();
    res.json({ ...result, state: bot.getFullState() });
  });

  // 2. Flush pending server-side toasts
  app.get("/api/bot/toasts", (req, res) => {
    res.json(bot.flushToasts());
  });

  // 3. Start bot background worker
  app.post("/api/bot/start", (req, res) => {
    bot.startBot();
    res.json(bot.getFullState());
  });

  // 4. Stop bot background worker
  app.post("/api/bot/stop", (req, res) => {
    bot.stopBot();
    res.json(bot.getFullState());
  });

  // 5. Update configuration
  app.post("/api/bot/config", (req, res) => {
    bot.updateConfig(req.body);
    res.json(bot.getFullState());
  });

  // 6. Clear transaction logs
  app.post("/api/bot/clear-logs", (req, res) => {
    bot.clearLogs();
    res.json(bot.getFullState());
  });

  // 7. Dismiss summary modal popup
  app.post("/api/bot/dismiss-summary", (req, res) => {
    bot.dismissSummary();
    res.json(bot.getFullState());
  });

  // 8. Reset dynamic demo/simulated balance
  app.post("/api/bot/reset-demo-balance", (req, res) => {
    bot.resetDemoBalance();
    res.json(bot.getFullState());
  });

  // Vite development middleware vs. static production files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express and Vite Server executing on http://localhost:${PORT}`);
  });
}

startServer().catch((e) => {
  console.error("Failure while launching Express backend:", e);
});
