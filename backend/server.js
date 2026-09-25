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

const createBotsRouter =
  require("./routes/bots");

const createEntryModelsRouter =
  require("./routes/entryModels");

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
// SHARED SERVICES
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
// BOT ROUTES
// ============================================================
//
// Bot logic lives in:
//
//     ./routes/bots.js
//
// We pass the SAME shared services.
//
// ============================================================

const botsRouter =
  createBotsRouter({
    orders,
    positions,
  });

app.use(
  "/api/bots",
  botsRouter
);

// ============================================================
// ENTRY MODEL ROUTES
// ============================================================
//
// TEMPORARY STANDALONE TEST MODULE
//
// Entry Model:
// - DOES NOT open trades
// - DOES NOT close trades
// - DOES NOT modify positions
// - DOES NOT create TP
// - DOES NOT create SL
//
// It only performs orderbook analysis.
//
// ============================================================

const entryModelsRouter =
  createEntryModelsRouter();

app.use(
  "/api/entry-models",
  entryModelsRouter
);

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
// POLUSDT TEST LONG
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
// POLUSDT TEST SHORT
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
// POLUSDT TEST CLOSE
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
// POLUSDT TEST TP/SL
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
        !Array.isArray(
          raw
        )
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
