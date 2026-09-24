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

// ============================================================
// SERVER
// ============================================================

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
      "GET,POST,OPTIONS"
    );

    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );

    if (
      req.method ===
      "OPTIONS"
    ) {
      return res.sendStatus(204);
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
// HEALTH
// ============================================================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      status: "online",
      project: "WEEX Bot V4",
      backend: "Node.js",
      weexBaseUrl: config.baseUrl,
      authenticated: Boolean(
        config.apiKey &&
        config.apiSecret &&
        config.passphrase
      ),
      port: config.port,
    });
  }
);

// ============================================================
// ACCOUNT BALANCE
// ============================================================

app.get(
  "/api/weex/account",
  async (req, res) => {
    try {
      const result =
        await account.getBalance();

      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error(
        "[WEEX ACCOUNT ERROR]",
        error
      );

      res.status(
        error.status || 500
      ).json({
        success: false,
        error: error.message,
        weex: error.data || null,
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

      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error(
        "[WEEX CONFIG ERROR]",
        error
      );

      res.status(
        error.status || 500
      ).json({
        success: false,
        error: error.message,
        weex: error.data || null,
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
        await positions.getAllPositions();

      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error(
        "[WEEX POSITIONS ERROR]",
        error
      );

      res.status(
        error.status || 500
      ).json({
        success: false,
        error: error.message,
        weex: error.data || null,
      });
    }
  }
);

// ============================================================
// POLUSDT MARKET INFORMATION
// ============================================================

app.get(
  "/api/test/polusdt",
  async (req, res) => {
    try {
      const data =
        await marketData.getSymbolInfo(
          "POLUSDT"
        );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        "[POLUSDT MARKET ERROR]",
        error
      );

      res.status(
        error.status || 500
      ).json({
        success: false,
        error: error.message,
        weex: error.data || null,
      });
    }
  }
);

// ============================================================
// OPEN POLUSDT TEST LONG
// ============================================================

app.post(
  "/api/test/polusdt/long",
  async (req, res) => {
    try {
      console.log(
        "[TEST] POLUSDT LONG requested."
      );

      const result =
        await orders.openTestPosition(
          "LONG"
        );

      res.json(result);
    } catch (error) {
      console.error(
        "[POLUSDT LONG ERROR]",
        error
      );

      res.status(
        error.status || 500
      ).json({
        success: false,
        error: error.message,
        weex: error.data || null,
      });
    }
  }
);

// ============================================================
// OPEN POLUSDT TEST SHORT
// ============================================================

app.post(
  "/api/test/polusdt/short",
  async (req, res) => {
    try {
      console.log(
        "[TEST] POLUSDT SHORT requested."
      );

      const result =
        await orders.openTestPosition(
          "SHORT"
        );

      res.json(result);
    } catch (error) {
      console.error(
        "[POLUSDT SHORT ERROR]",
        error
      );

      res.status(
        error.status || 500
      ).json({
        success: false,
        error: error.message,
        weex: error.data || null,
      });
    }
  }
);

// ============================================================
// CLOSE POLUSDT TEST POSITION
// ============================================================

app.post(
  "/api/test/polusdt/close",
  async (req, res) => {
    try {
      console.log(
        "[TEST] POLUSDT CLOSE requested."
      );

      const result =
        await orders.closeTestPosition();

      res.json(result);
    } catch (error) {
      console.error(
        "[POLUSDT CLOSE ERROR]",
        error
      );

      res.status(
        error.status || 500
      ).json({
        success: false,
        error: error.message,
        weex: error.data || null,
      });
    }
  }
);

// ============================================================
// UPDATE POLUSDT TEST TP / SL
// ============================================================

app.post(
  "/api/test/polusdt/tpsl",
  async (req, res) => {
    try {
      const {
        slPercent,
        tpPercent,
      } = req.body;

      console.log(
        "[TEST] POLUSDT TP/SL UPDATE requested."
      );

      const result =
        await orders.updateTestTpSl(
          slPercent,
          tpPercent
        );

      res.json(result);
    } catch (error) {
      console.error(
        "[POLUSDT TP/SL ERROR]",
        error
      );

      res.status(
        error.status || 500
      ).json({
        success: false,
        error: error.message,
        weex: error.data || null,
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
    console.log("");

    console.log(
      "=========================================="
    );

    console.log(
      "        WEEX BOT V4 BACKEND"
    );

    console.log(
      "=========================================="
    );

    console.log(
      `Backend: http://localhost:${config.port}`
    );

    console.log(
      `WEEX:    ${config.baseUrl}`
    );

    console.log(
      `Auth:    ${
        config.apiKey &&
        config.apiSecret &&
        config.passphrase
          ? "CONFIGURED"
          : "MISSING"
      }`
    );

    console.log(
      "=========================================="
    );

    console.log("");
  }
);