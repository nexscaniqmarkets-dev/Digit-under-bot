import express from "express";
import path from "path";
import https from "https";
import fs from "fs";
import { MongoClient, Collection } from "mongodb";
import { createServer as createViteServer } from "vite";
import { botManager } from "./server-bot";

// ─── Telegram Webhook Setup ────────────────────────────────────────────────────

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
          if (parsed.ok) console.log(`[TG] Webhook registered: ${webhookUrl}`);
          else console.error("[TG] Webhook registration failed:", parsed.description);
        } catch (_) {}
      });
    }
  );
  req.on("error", (e) => console.error("[TG] Webhook registration error:", e.message));
  req.write(body);
  req.end();
}

// ─── MongoDB Session Store ────────────────────────────────────────────────────
// Persists user sessions across redeploys using MongoDB Atlas free tier.

let sessionsCollection: Collection | null = null;

async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("[MongoDB] MONGODB_URI not set — sessions will not persist across redeploys");
    return;
  }
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("digit-under-bot");
    sessionsCollection = db.collection("sessions");
    // Create index for fast lookup
    await sessionsCollection.createIndex({ telegramId: 1 }, { unique: true });
    console.log("[MongoDB] Connected — sessions will persist across redeploys ✅");
  } catch (e) {
    console.error("[MongoDB] Connection failed:", e);
  }
}

async function getSession(telegramId: string): Promise<string | null> {
  if (!sessionsCollection) return null;
  try {
    const doc = await sessionsCollection.findOne({ telegramId });
    return doc?.derivToken ?? null;
  } catch { return null; }
}

async function saveSession(telegramId: string, derivToken: string): Promise<void> {
  if (!sessionsCollection) return;
  try {
    await sessionsCollection.updateOne(
      { telegramId },
      { $set: { telegramId, derivToken, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (e) { console.error("[MongoDB] saveSession error:", e); }
}

async function deleteSession(telegramId: string): Promise<void> {
  if (!sessionsCollection) return;
  try {
    await sessionsCollection.deleteOne({ telegramId });
  } catch (e) { console.error("[MongoDB] deleteSession error:", e); }
}

// ── Bank Balance (with file fallback when MongoDB unavailable) ────────────────
const BANK_FILE = path.join(process.cwd(), "bank-balances.json");

function loadBankFile(): Record<string, number> {
  try {
    if (!fs.existsSync(BANK_FILE)) return {};
    return JSON.parse(fs.readFileSync(BANK_FILE, "utf-8"));
  } catch { return {}; }
}

function saveBankFile(data: Record<string, number>) {
  try { fs.writeFileSync(BANK_FILE, JSON.stringify(data, null, 2)); } catch {}
}

async function getBankBalance(telegramId: string): Promise<number> {
  if (sessionsCollection) {
    try {
      const doc = await sessionsCollection.findOne({ telegramId });
      return doc?.bankBalance ?? 0;
    } catch {}
  }
  // Fallback to file
  return loadBankFile()[telegramId] ?? 0;
}

async function setBankBalanceDB(telegramId: string, amount: number): Promise<void> {
  if (sessionsCollection) {
    try {
      await sessionsCollection.updateOne(
        { telegramId },
        { $set: { bankBalance: amount } },
        { upsert: true }
      );
      return;
    } catch {}
  }
  // Fallback to file
  const data = loadBankFile();
  data[telegramId] = amount;
  saveBankFile(data);
}

// ─── Express App ──────────────────────────────────────────────────────────────

async function startServer() {
  await connectMongo();

  // Register a global handler so EVERY trade settlement immediately persists
  // the sandbox demo balance to MongoDB — not just on polling. This guarantees
  // no trade result is ever lost even if the app closes the instant after a trade.
  botManager.setGlobalBalanceChangeHandler((telegramId, balance) => {
    if (!sessionsCollection) return;
    sessionsCollection.updateOne(
      { telegramId },
      { $set: { demoBalance: balance } },
      { upsert: true }
    ).catch((e) => console.error("[MongoDB] Immediate balance save failed:", e));
  });

  const app = express();
  const PORT = Number(process.env.PORT ?? 3000);

  app.use(express.json());

  // Helper: get bot for a request (by telegramId)
  function getBot(req: express.Request) {
    const telegramId = req.body?.telegramId || req.query?.telegramId as string || "default";
    return botManager.getBot(String(telegramId));
  }

  // ── Bot REST API ─────────────────────────────────────────────────────────────

  app.get("/api/bot/state", async (req, res) => {
    const telegramId = req.query?.telegramId as string || "default";
    const bot = botManager.getBot(telegramId);
    // Always sync bank balance from DB on state fetch
    const bankBal = await getBankBalance(telegramId);
    bot.setBankBalance(bankBal);
    const state = bot.getFullState();
    // NOTE: demoBalance is intentionally NOT written here. Writing on every poll risked
    // overwriting the correct MongoDB value with a freshly-constructed bot's default
    // (10000) before restore-sandbox/auto-login had a chance to restore the real balance
    // after a cold start. demoBalance is now only persisted immediately after each trade
    // settles (via the onBalanceChange callback in server-bot.ts).
    res.json(state);
  });

  app.post("/api/auth/login", async (req, res) => {
    const bot = getBot(req);
    const { token } = req.body;
    const result = await bot.loginWithToken(token);
    res.json({ ...result, state: bot.getFullState() });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const { telegramId } = req.body;
    if (telegramId) await deleteSession(String(telegramId));
    const bot = getBot(req);
    const result = bot.logout();
    res.json({ ...result, state: bot.getFullState() });
  });

  app.get("/api/bot/toasts", (req, res) => {
    const telegramId = req.query?.telegramId as string || "default";
    const bot = botManager.getBot(telegramId);
    res.json(bot.flushToasts());
  });

  app.post("/api/bot/start", (req, res) => {
    const bot = getBot(req);
    bot.startBot();
    res.json(bot.getFullState());
  });

  app.post("/api/bot/stop", (req, res) => {
    const bot = getBot(req);
    bot.stopBot();
    res.json(bot.getFullState());
  });

  app.post("/api/bot/config", (req, res) => {
    const bot = getBot(req);
    bot.updateConfig(req.body);
    res.json(bot.getFullState());
  });

  app.post("/api/bot/clear-logs", (req, res) => {
    const bot = getBot(req);
    bot.clearLogs();
    res.json(bot.getFullState());
  });

  app.post("/api/bot/dismiss-summary", (req, res) => {
    const bot = getBot(req);
    bot.dismissSummary();
    res.json(bot.getFullState());
  });

  app.post("/api/bot/reset-demo-balance", async (req, res) => {
    const bot = getBot(req);
    bot.resetDemoBalance();
    res.json(bot.getFullState());
  });

  app.post("/api/auth/switch-to-demo", (req, res) => {
    const bot = getBot(req);
    const result = bot.switchToDemo();
    const telegramId = req.body?.telegramId || "default";
    if (sessionsCollection) {
      sessionsCollection.updateOne(
        { telegramId: String(telegramId) },
        { $set: { lastMode: "demo" } },
        { upsert: true }
      ).catch(() => {});
    }
    res.json({ ...result, state: bot.getFullState() });
  });

  // ── Sandbox State Restore ─────────────────────────────────────────────────
  app.post("/api/auth/restore-sandbox", async (req, res) => {
    const { telegramId } = req.body;
    if (!telegramId) return res.json({ success: false });
    const bot = botManager.getBot(String(telegramId));
    if (sessionsCollection) {
      try {
        const doc = await sessionsCollection.findOne({ telegramId: String(telegramId) });
        console.log(`[Restore] telegramId=${telegramId} found doc:`, doc ? { bankBalance: doc.bankBalance, demoBalance: doc.demoBalance, lastMode: doc.lastMode } : "NO DOC FOUND");
        if (doc?.bankBalance != null) bot.setBankBalance(doc.bankBalance);
        if (doc?.demoBalance != null) {
          bot.restoreDemoBalance(doc.demoBalance);
          console.log(`[Restore] Restored sandbox balance to ${doc.demoBalance} for ${telegramId}`);
        } else {
          console.log(`[Restore] No demoBalance found in DB for ${telegramId} — bot will use default`);
        }
      } catch (e) {
        console.error("[Restore] Error during restore-sandbox:", e);
      }
    } else {
      console.log("[Restore] sessionsCollection not available (MongoDB not connected)");
    }
    res.json({ success: true, state: bot.getFullState() });
  });

  app.post("/api/auth/save-session", async (req, res) => {
    const { telegramId, derivToken } = req.body;
    if (!telegramId || !derivToken) return res.json({ success: false });
    await saveSession(String(telegramId), derivToken);
    if (sessionsCollection) {
      sessionsCollection.updateOne(
        { telegramId: String(telegramId) },
        { $set: { lastMode: "deriv" } },
        { upsert: true }
      ).catch(() => {});
    }
    res.json({ success: true });
  });

  app.post("/api/auth/auto-login", async (req, res) => {
    const { telegramId } = req.body;
    if (!telegramId) return res.json({ success: false });
    // Only auto-login to Deriv if the user's last active mode was actually "deriv"
    if (sessionsCollection) {
      try {
        const doc = await sessionsCollection.findOne({ telegramId: String(telegramId) });
        if (doc?.lastMode === "demo") {
          return res.json({ success: false, reason: "last_mode_was_demo" });
        }
      } catch {}
    }
    const token = await getSession(String(telegramId));
    if (!token) return res.json({ success: false, reason: "no_session" });
    const bot = botManager.getBot(String(telegramId));
    // Restore bank balance and demoBalance from MongoDB
    if (sessionsCollection) {
      try {
        const doc = await sessionsCollection.findOne({ telegramId: String(telegramId) });
        if (doc?.bankBalance != null) bot.setBankBalance(doc.bankBalance);
        if (doc?.demoBalance != null) bot.restoreDemoBalance(doc.demoBalance);
      } catch {}
    }
    const result = await bot.loginWithToken(token);
    res.json({ ...result, state: bot.getFullState() });
  });

  // Dedicated endpoint for the manual toggle switch — always uses saved token,
  // bypasses the lastMode gate (which is only for app-reopen auto-login)
  app.post("/api/auth/switch-to-deriv", async (req, res) => {
    const { telegramId } = req.body;
    if (!telegramId) return res.json({ success: false });
    const token = await getSession(String(telegramId));
    if (!token) return res.json({ success: false, reason: "no_session" });
    const bot = botManager.getBot(String(telegramId));
    if (sessionsCollection) {
      try {
        const doc = await sessionsCollection.findOne({ telegramId: String(telegramId) });
        if (doc?.bankBalance != null) bot.setBankBalance(doc.bankBalance);
        if (doc?.demoBalance != null) bot.restoreDemoBalance(doc.demoBalance);
      } catch {}
    }
    const result = await bot.loginWithToken(token);
    // Mark this as the active mode so future app-reopens restore Deriv correctly
    if (result.success && sessionsCollection) {
      sessionsCollection.updateOne(
        { telegramId: String(telegramId) },
        { $set: { lastMode: "deriv" } },
        { upsert: true }
      ).catch(() => {});
    }
    res.json({ ...result, state: bot.getFullState() });
  });

  // ── Reserved Bank ─────────────────────────────────────────────────────────────

  app.get("/api/bank/balance", async (req, res) => {
    const telegramId = req.query?.telegramId as string || "default";
    const balance = await getBankBalance(telegramId);
    res.json({ balance });
  });

  app.post("/api/bank/deposit", async (req, res) => {
    const { telegramId, amount } = req.body;
    if (!telegramId || !amount) return res.json({ success: false, error: "Missing fields" });
    try {
      const currentBank = await getBankBalance(String(telegramId));
      const newBank = currentBank + parseFloat(amount);
      await setBankBalanceDB(String(telegramId), newBank);
      const bot = botManager.getBot(String(telegramId));
      bot.setBankBalance(newBank);
      // Also save current demoBalance to MongoDB for persistence
      const state = bot.getFullState();
      if (state.config?.demoBalance !== undefined && sessionsCollection) {
        await sessionsCollection.updateOne(
          { telegramId: String(telegramId) },
          { $set: { demoBalance: state.config.demoBalance } },
          { upsert: true }
        ).catch(() => {});
      }
      res.json({ success: true, bankBalance: newBank });
    } catch (e) { res.json({ success: false, error: "Storage error" }); }
  });

  app.post("/api/bank/withdraw", async (req, res) => {
    const { telegramId, amount } = req.body;
    if (!telegramId || !amount) return res.json({ success: false, error: "Missing fields" });
    try {
      const currentBank = await getBankBalance(String(telegramId));
      const withdrawAmount = parseFloat(amount);
      if (withdrawAmount > currentBank) return res.json({ success: false, error: "Insufficient bank balance" });
      const newBank = currentBank - withdrawAmount;
      await setBankBalanceDB(String(telegramId), newBank);
      botManager.getBot(String(telegramId)).setBankBalance(newBank);
      res.json({ success: true, bankBalance: newBank });
    } catch (e) { res.json({ success: false, error: "Storage error" }); }
  });

  app.post("/api/telegram/webhook", (req, res) => {
    const update = req.body;
    res.sendStatus(200);

    const message = update?.message;
    if (!message?.text) return;

    const chatId = String(message.chat.id);
    const text: string = message.text.trim().toLowerCase();
    const bot = botManager.getBot(chatId);
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
        `Daily trades: ${state.dailyTradesCount ?? 0}`
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
