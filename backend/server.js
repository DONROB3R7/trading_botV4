const express = require("express");

const {
  config,
} = require("../config/weex");

const WeexClient =
  require("../execution/weexClient");

const AccountService =
  require("../execution/account");

const PositionService =
  require("../execution/positions");

const MarketData =
  require("../market/marketData");

const OrderService =
  require("../execution/orders");

const app =
  express();

// ============================================================
// CORS
// ============================================================

app.use(
  (req, res, next) => {
    res.header(
      "Access-Control-Allow-Origin",
      "http://localhost:5173"
    );

    res.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS"
    );

    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );

    if (
      req.method ===
      "OPTIONS"
    ) {
      return res.sendStatus(
        200
      );
    }

    next();
  }
);

app.use(
  express.json()
);

// ============================================================
// SERVICES
// ============================================================

const weex =
  new WeexClient();

const account =
  new AccountService(
    weex
  );

const positions =
  new PositionService(
    weex
  );

const marketData =
  new MarketData(
    weex
  );

const orders =
  new OrderService(
    weex
  );

// ============================================================
// BOT STORAGE
// ============================================================

const bots = [];

// ============================================================
// BOT TP/SL TIMERS
// ============================================================

const botTimers =
  new Map();

const TP_SL_DELAY_MS =
  30 * 1000;

// ============================================================
// HEALTH
// ============================================================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      status:
        "online",

      project:
        "WEEX Bot Lab",

      backend:
        "Node.js",

      port:
        config.port,

      weexConfigured:
        Boolean(
          process.env.WEEX_API_KEY &&
          process.env.WEEX_API_SECRET &&
          process.env.WEEX_API_PASSPHRASE
        ),
    });
  }
);

// ============================================================
// ACCOUNT
// ============================================================

app.get(
  "/api/weex/account",
  async (req, res) => {
    try {
      const result =
        await account.getBalance();

      res.json(
        result
      );
    } catch (error) {
      console.error(
        "[API] Account error:",
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// ACCOUNT CONFIG
// ============================================================

app.get(
  "/api/weex/account-config",
  async (req, res) => {
    try {
      const result =
        await account.getConfig();

      res.json(
        result
      );
    } catch (error) {
      console.error(
        "[API] Account config error:",
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// POSITIONS
// ============================================================

app.get(
  "/api/weex/positions",
  async (req, res) => {
    try {
      const result =
        await positions.getAll();

      res.json(
        result
      );
    } catch (error) {
      console.error(
        "[API] Positions error:",
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// TRADING SYMBOLS
// ============================================================

app.get(
  "/api/weex/trading-symbols",
  async (req, res) => {
    try {
      const result =
        await marketData.getApiTradingSymbols();

      const symbols =
        Array.isArray(
          result.data
        )
          ? result.data
          : [];

      res.json({
        success:
          true,

        data:
          symbols
            .map(
              (symbol) =>
                String(
                  symbol
                )
                  .toUpperCase()
                  .trim()
            )
            .sort(),
      });
    } catch (error) {
      console.error(
        "[API] Trading symbols error:",
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// POLUSDT TEST
// ============================================================

app.get(
  "/api/test/polusdt",
  async (req, res) => {
    try {
      const result =
        await marketData.getSymbolInfo(
          "POLUSDT"
        );

      res.json({
        success:
          true,

        data:
          result,
      });
    } catch (error) {
      console.error(
        "[API] POLUSDT test error:",
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// OLD TEST LONG
// ============================================================

app.post(
  "/api/test/polusdt/long",
  async (req, res) => {
    try {
      const result =
        await orders.openTestPosition(
          "POLUSDT",
          "LONG"
        );

      res.json({
        success:
          true,

        data:
          result,
      });
    } catch (error) {
      console.error(
        "[API] POLUSDT LONG error:",
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// OLD TEST SHORT
// ============================================================

app.post(
  "/api/test/polusdt/short",
  async (req, res) => {
    try {
      const result =
        await orders.openTestPosition(
          "POLUSDT",
          "SHORT"
        );

      res.json({
        success:
          true,

        data:
          result,
      });
    } catch (error) {
      console.error(
        "[API] POLUSDT SHORT error:",
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// OLD TEST CLOSE
// ============================================================

app.post(
  "/api/test/polusdt/close",
  async (req, res) => {
    try {
      const result =
        await orders.closeTestPosition(
          "POLUSDT"
        );

      res.json({
        success:
          true,

        data:
          result,
      });
    } catch (error) {
      console.error(
        "[API] POLUSDT CLOSE error:",
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// OLD TEST TP/SL
// ============================================================

app.post(
  "/api/test/polusdt/tpsl",
  async (req, res) => {
    try {
      const {
        stopLoss,
        takeProfit,
      } = req.body;

      const result =
        await orders.updateTestTpSl(
          "POLUSDT",
          stopLoss,
          takeProfit
        );

      res.json({
        success:
          true,

        data:
          result,
      });
    } catch (error) {
      console.error(
        "[API] POLUSDT TP/SL error:",
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// CHART
// ============================================================

app.get(
  "/api/chart/:symbol",
  async (req, res) => {
    try {
      const symbol =
        String(
          req.params.symbol
        )
          .toUpperCase()
          .trim();

      if (!symbol) {
        throw new Error(
          "Chart symbol is required"
        );
      }

      const result =
        await marketData.getKlines(
          symbol,
          "1m",
          200
        );

      const raw =
        result?.data;

      if (
        !Array.isArray(raw)
      ) {
        throw new Error(
          "WEEX returned invalid candle data"
        );
      }

      const candles =
        raw
          .map(
            (candle) => ({
              time:
                Number(
                  candle[0]
                ) / 1000,

              open:
                Number(
                  candle[1]
                ),

              high:
                Number(
                  candle[2]
                ),

              low:
                Number(
                  candle[3]
                ),

              close:
                Number(
                  candle[4]
                ),
            })
          )
          .filter(
            (candle) =>
              Number.isFinite(
                candle.time
              ) &&
              Number.isFinite(
                candle.open
              ) &&
              Number.isFinite(
                candle.high
              ) &&
              Number.isFinite(
                candle.low
              ) &&
              Number.isFinite(
                candle.close
              )
          )
          .sort(
            (a, b) =>
              a.time -
              b.time
          );

      res.json({
        success:
          true,

        symbol,

        data:
          candles,
      });
    } catch (error) {
      console.error(
        `[API] Chart ${req.params.symbol} error:`,
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// GET BOTS
// ============================================================

app.get(
  "/api/bots",
  (req, res) => {
    res.json({
      success:
        true,

      data:
        bots,
    });
  }
);

// ============================================================
// CREATE BOT
// ============================================================

app.post(
  "/api/bots",
  (req, res) => {
    try {
      const {
        name,
        symbol,
        direction,
        entryModel,
        stopLoss,
        takeProfit,
      } = req.body;

      const cleanName =
        String(
          name || ""
        ).trim();

      if (!cleanName) {
        return res.status(400).json({
          success:
            false,

          error:
            "Bot name is required",
        });
      }

      const cleanSymbol =
        String(
          symbol || ""
        )
          .toUpperCase()
          .trim();

      if (!cleanSymbol) {
        return res.status(400).json({
          success:
            false,

          error:
            "Trading symbol is required",
        });
      }

      const cleanDirection =
        String(
          direction || ""
        )
          .toUpperCase()
          .trim();

      if (
        cleanDirection !==
          "LONG" &&
        cleanDirection !==
          "SHORT"
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            "Direction must be LONG or SHORT",
        });
      }

      const sl =
        Number(
          stopLoss
        );

      const tp =
        Number(
          takeProfit
        );

      if (
        !Number.isFinite(sl) ||
        sl <= 0
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            "Stop Loss must be greater than 0",
        });
      }

      if (
        !Number.isFinite(tp) ||
        tp <= 0
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            "Take Profit must be greater than 0",
        });
      }

      const bot = {
        id:
          `bot_${Date.now()}`,

        name:
          cleanName,

        symbol:
          cleanSymbol,

        direction:
          cleanDirection,

        entryModel:
          entryModel ||
          "BUTTON_PRESS",

        stopLoss:
          sl,

        takeProfit:
          tp,

        status:
          "ACTIVE",

        createdAt:
          new Date().toISOString(),
      };

      bots.push(
        bot
      );

      console.log(
        `[Bot] Created ${bot.name} | ${bot.symbol} | ${bot.direction}`
      );

      res.json({
        success:
          true,

        data:
          bot,
      });
    } catch (error) {
      console.error(
        "[API] Create bot error:",
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// ENTER BOT POSITION
// ============================================================

app.post(
  "/api/bots/:id/enter",
  async (req, res) => {
    const botId =
      String(
        req.params.id || ""
      ).trim();

    const bot =
      bots.find(
        (item) =>
          item.id ===
          botId
      );

    if (!bot) {
      return res.status(404).json({
        success:
          false,

        error:
          "Bot not found",
      });
    }

    if (
      bot.status !==
      "ACTIVE"
    ) {
      return res.status(400).json({
        success:
          false,

        error:
          "Bot is paused",
      });
    }

    // ----------------------------------------------------------
    // Prevent starting another lifecycle for the same bot.
    // ----------------------------------------------------------

    if (
      botTimers.has(
        bot.id
      )
    ) {
      return res.status(400).json({
        success:
          false,

        error:
          "Bot is already waiting for TP/SL",
      });
    }

    try {
      console.log(
        `[Bot:${bot.name}] ENTER ${bot.direction} ${bot.symbol}`
      );

      // --------------------------------------------------------
      // MARKET ENTRY
      // --------------------------------------------------------

      const entryResult =
        await orders.openTestPosition(
          bot.symbol,
          bot.direction
        );

      console.log(
        `[Bot:${bot.name}] Position opened`
      );

      // --------------------------------------------------------
      // START 30 SECOND TP/SL TIMER
      // --------------------------------------------------------

      const timer =
        setTimeout(
          async () => {
            try {
              console.log(
                `[Bot:${bot.name}] 30 seconds complete - creating TP/SL`
              );

              await orders.updateTestTpSl(
                bot.symbol,
                bot.stopLoss,
                bot.takeProfit
              );

              console.log(
                `[Bot:${bot.name}] TP/SL created`
              );
            } catch (error) {
              console.error(
                `[Bot:${bot.name}] TP/SL timer error:`,
                error
              );
            } finally {
              botTimers.delete(
                bot.id
              );
            }
          },
          TP_SL_DELAY_MS
        );

      botTimers.set(
        bot.id,
        timer
      );

      res.json({
        success:
          true,

        message:
          "Position opened. TP/SL will be created in 30 seconds.",

        data: {
          botId:
            bot.id,

          botName:
            bot.name,

          symbol:
            bot.symbol,

          direction:
            bot.direction,

          delaySeconds:
            30,

          entry:
            entryResult,
        },
      });
    } catch (error) {
      console.error(
        `[Bot:${bot.name}] ENTER error:`,
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// CLOSE BOT POSITION
// ============================================================

app.post(
  "/api/bots/:id/close",
  async (req, res) => {
    const botId =
      String(
        req.params.id || ""
      ).trim();

    const bot =
      bots.find(
        (item) =>
          item.id ===
          botId
      );

    if (!bot) {
      return res.status(404).json({
        success:
          false,

        error:
          "Bot not found",
      });
    }

    try {
      // --------------------------------------------------------
      // Cancel pending TP/SL timer.
      // --------------------------------------------------------

      const timer =
        botTimers.get(
          bot.id
        );

      if (timer) {
        clearTimeout(
          timer
        );

        botTimers.delete(
          bot.id
        );

        console.log(
          `[Bot:${bot.name}] Pending TP/SL timer cancelled`
        );
      }

      // --------------------------------------------------------
      // Close actual position.
      // --------------------------------------------------------

      const result =
        await orders.closeTestPosition(
          bot.symbol
        );

      console.log(
        `[Bot:${bot.name}] Position closed`
      );

      res.json({
        success:
          true,

        message:
          "Position closed",

        data:
          result,
      });
    } catch (error) {
      console.error(
        `[Bot:${bot.name}] CLOSE error:`,
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// PAUSE BOT
// ============================================================

app.post(
  "/api/bots/:id/pause",
  (req, res) => {
    const bot =
      bots.find(
        (item) =>
          item.id ===
          req.params.id
      );

    if (!bot) {
      return res.status(404).json({
        success:
          false,

        error:
          "Bot not found",
      });
    }

    bot.status =
      "PAUSED";

    res.json({
      success:
        true,

      data:
        bot,
    });
  }
);

// ============================================================
// RESUME BOT
// ============================================================

app.post(
  "/api/bots/:id/resume",
  (req, res) => {
    const bot =
      bots.find(
        (item) =>
          item.id ===
          req.params.id
      );

    if (!bot) {
      return res.status(404).json({
        success:
          false,

        error:
          "Bot not found",
      });
    }

    bot.status =
      "ACTIVE";

    res.json({
      success:
        true,

      data:
        bot,
    });
  }
);

// ============================================================
// DELETE BOT
// ============================================================

app.delete(
  "/api/bots/:id",
  (req, res) => {
    try {
      const botId =
        String(
          req.params.id || ""
        ).trim();

      if (!botId) {
        return res.status(400).json({
          success:
            false,

          error:
            "Bot ID is required",
        });
      }

      const index =
        bots.findIndex(
          (bot) =>
            bot.id ===
            botId
        );

      if (index === -1) {
        return res.status(404).json({
          success:
            false,

          error:
            "Bot not found",
        });
      }

      // --------------------------------------------------------
      // Cancel timer if bot is waiting for TP/SL.
      // --------------------------------------------------------

      const timer =
        botTimers.get(
          botId
        );

      if (timer) {
        clearTimeout(
          timer
        );

        botTimers.delete(
          botId
        );
      }

      const deletedBot =
        bots[index];

      bots.splice(
        index,
        1
      );

      console.log(
        `[Bot] Deleted ${deletedBot.name} (${deletedBot.symbol})`
      );

      res.json({
        success:
          true,

        message:
          "Bot deleted",

        data:
          deletedBot,
      });
    } catch (error) {
      console.error(
        "[API] Delete bot error:",
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
  config.port,
  () => {
    console.log(
      `WEEX Bot Lab backend running on port ${config.port}`
    );
  }
);