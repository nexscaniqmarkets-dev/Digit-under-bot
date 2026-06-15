import express from "express";
import path from "path";
import https from "https";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { bot } from "./server-bot";

// ─── Telegram Webhook Setup ────────────────────────────────────────────────────
// Registers the bot webhook with Telegram so the bot can receive /commands.
// This runs once at startup when APP_URL and TELEGRAM_BOT_TOKEN are set.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.APP_URL;

function registerTelegramWebhook() {
  if (!BOT_TOKEN || !APP_URL) {
    console.log("[TG] Skipping webhook registration (TELEGRAM_BOT_TOKEN or APP_URL not set)");
    return;
  }

  const webhookUrl = `${APP_URL}/api/telegram/webhook`;
  const body = JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"] });

  const req = https.request(
    {
      hostname: "api.telegram.org",
      path: `/bot${BOT_TOKEN}/setWebhook`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            console.log(`[TG] Webhook registered: ${webhookUrl}`);
          } else {
            console.error("[TG] Webhook registration failed:", parsed.description);
          }
        } catch (_) {}
      });
    }
  );
  req.on("error", (e) => console.error("[TG] Webhook registration error:", e.message));
  req.write(body);
  req.end();
}

// ─── Express App ──────────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT ?? 3000);

  app.use(express.json());

  // ── Bot REST API ─────────────────────────────────────────────────────────────

  app.get("/api/bot/state", (_req, res) => {
    res.json(bot.getFullState());
  });

  app.post("/api/auth/login", async (req, res) => {
    const { token } = req.body;
    const result = await bot.loginWithToken(token);
    res.json({ ...result, state: bot.getFullState() });
  });

  // ── Session Persistence (auto-login by Telegram ID) ─────────────────────────
  // Saves Deriv token linked to Telegram user ID so users stay logged in

  const SESSION_FILE = path.join(process.cwd(), "tg-sessions.json");

  function loadSessions(): Record<string, string> {
    try {
      if (!fs.existsSync(SESSION_FILE)) return {};
      return JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
    } catch { return {}; }
  }

  function saveSessions(sessions: Record<string, string>) {
    try { fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2)); } catch {}
  }

  // Save session after login
  app.post("/api/auth/save-session", (req, res) => {
    const { telegramId, derivToken } = req.body;
    if (!telegramId || !derivToken) return res.json({ success: false });
    const sessions = loadSessions();
    sessions[String(telegramId)] = derivToken;
    saveSessions(sessions);
    res.json({ success: true });
  });

  // Auto-login on app open using saved Telegram session
  app.post("/api/auth/auto-login", async (req, res) => {
    const { telegramId } = req.body;
    if (!telegramId) return res.json({ success: false });
    const sessions = loadSessions();
    const token = sessions[String(telegramId)];
    if (!token) return res.json({ success: false, reason: "no_session" });
    const result = await bot.loginWithToken(token);
    res.json({ ...result, state: bot.getFullState() });
  });

  // Clear session on logout
  app.post("/api/auth/logout", (req, res) => {
    const { telegramId } = req.body;
    if (telegramId) {
      const sessions = loadSessions();
      delete sessions[String(telegramId)];
      saveSessions(sessions);
    }
    const result = bot.logout();
    res.json({ ...result, state: bot.getFullState() });
  });

  app.get("/api/bot/toasts", (_req, res) => {
    res.json(bot.flushToasts());
  });

  app.post("/api/bot/start", (_req, res) => {
    bot.startBot();
    res.json(bot.getFullState());
  });

  app.post("/api/bot/stop", (_req, res) => {
    bot.stopBot();
    res.json(bot.getFullState());
  });

  app.post("/api/bot/config", (req, res) => {
    bot.updateConfig(req.body);
    res.json(bot.getFullState());
  });

  app.post("/api/bot/clear-logs", (_req, res) => {
    bot.clearLogs();
    res.json(bot.getFullState());
  });

  app.post("/api/bot/dismiss-summary", (_req, res) => {
    bot.dismissSummary();
    res.json(bot.getFullState());
  });

  app.post("/api/bot/reset-demo-balance", (_req, res) => {
    bot.resetDemoBalance();
    res.json(bot.getFullState());
  });

  // ── Telegram Webhook ──────────────────────────────────────────────────────────
  // Receives updates from Telegram (user sends /start, /status, /stop, etc.)

  app.post("/api/telegram/webhook", (req, res) => {
    const update = req.body;
    res.sendStatus(200); // Acknowledge immediately

    const message = update?.message;
    if (!message?.text) return;

    const chatId = String(message.chat.id);
    const text: string = message.text.trim().toLowerCase();
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    // Only respond to admin (optional security gate)
    if (adminChatId && chatId !== adminChatId) {
      sendTelegramMessage(chatId, "⛔ You are not authorized to control this bot.");
      return;
    }

    const state = bot.getFullState();

    if (text === "/start" || text === "/help") {
      sendTelegramMessage(chatId,
        `🤖 *Digit Under Bot*\n\n` +
        `Commands:\n` +
        `/status — Current bot state & P\\&L\n` +
        `/start\\_bot — Start trading session\n` +
        `/stop\\_bot — Stop trading session\n` +
        `/balance — Show current balance\n` +
        `/logs — Last 5 trades`
      );
    } else if (text === "/status") {
      sendTelegramMessage(chatId,
        `📊 *Bot Status*\n` +
        `State: \`${state.botState}\`\n` +
        `Balance: \`$${state.balance ?? "—"}\`\n` +
        `Session P&L: \`$${state.sessionProfit?.toFixed(2) ?? "0.00"}\`\n` +
        `Daily trades: ${state.dailyTradesCount ?? 0}\n` +
        `Active symbol: ${state.activeSymbol ?? "None"}`
      );
    } else if (text === "/balance") {
      sendTelegramMessage(chatId, `💰 Balance: \`$${state.balance ?? "—"}\``);
    } else if (text === "/start_bot") {
      bot.startBot();
      sendTelegramMessage(chatId, `🚀 Bot started!`);
    } else if (text === "/stop_bot") {
      bot.stopBot();
      sendTelegramMessage(chatId, `🛑 Bot stopped.`);
    } else if (text === "/logs") {
      const logs: any[] = state.tradeLogs?.slice(0, 5) ?? [];
      if (logs.length === 0) {
        sendTelegramMessage(chatId, "No trades yet.");
      } else {
        const lines = logs.map((l: any) =>
          `${l.outcome === "WIN" ? "✅" : "❌"} ${l.symbol} | $${l.profit >= 0 ? "+" : ""}${l.profit?.toFixed(2)}`
        );
        sendTelegramMessage(chatId, `📋 *Last ${logs.length} Trades*\n${lines.join("\n")}`);
      }
    } else {
      sendTelegramMessage(chatId, `Unknown command. Send /help for available commands.`);
    }
  });

  // ── Static frontend / Vite dev ───────────────────────────────────────────────

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    registerTelegramWebhook();
  });
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function sendTelegramMessage(chatId: string, text: string) {
  if (!BOT_TOKEN) return;
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" });
  const req = https.request(
    {
      hostname: "api.telegram.org",
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    },
    () => {}
  );
  req.on("error", () => {});
  req.write(body);
  req.end();
}

startServer().catch((e) => {
  console.error("Failed to start server:", e);
  process.exit(1);
});
