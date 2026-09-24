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

        // ------------------------------------------------------
        // NEW FRONTEND FIELD
        // ------------------------------------------------------
        //
        // New UI sends:
        //
        // pyramidPositions
        //
        // Old backend used:
        //
        // maxPositions
        //
        // We support BOTH.
        // ------------------------------------------------------

        pyramidPositions,
        maxPositions,
      } = req.body;

      // --------------------------------------------------------
      // NAME
      // --------------------------------------------------------

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

      // --------------------------------------------------------
      // SYMBOL
      // --------------------------------------------------------

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

      // --------------------------------------------------------
      // DIRECTION
      // --------------------------------------------------------

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

      // --------------------------------------------------------
      // PYRAMID POSITIONS
      // --------------------------------------------------------
      //
      // Frontend:
      //
      // pyramidPositions
      //
      // Backward compatibility:
      //
      // maxPositions
      //
      // Default:
      //
      // 1 = no additional entries
      // --------------------------------------------------------

      const requestedPyramidPositions =
        pyramidPositions !==
        undefined
          ? pyramidPositions
          : maxPositions;

      const cleanPyramidPositions =
        Number(
          requestedPyramidPositions ===
            undefined
            ? 1
            : requestedPyramidPositions
        );

      if (
        !Number.isInteger(
          cleanPyramidPositions
        ) ||
        ![1, 2, 3].includes(
          cleanPyramidPositions
        )
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            "Pyramid positions must be 1, 2, or 3",
        });
      }

      // --------------------------------------------------------
      // STOP LOSS
      // --------------------------------------------------------

      const sl =
        Number(
          stopLoss
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

      // --------------------------------------------------------
      // TAKE PROFIT
      // --------------------------------------------------------

      const tp =
        Number(
          takeProfit
        );

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

      // --------------------------------------------------------
      // CREATE BOT
      // --------------------------------------------------------

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

        // ======================================================
        // PYRAMID SETTINGS
        // ======================================================
        //
        // pyramidPositions is the official frontend setting.
        //
        // maxPositions is kept as a backend compatibility alias.
        // Both always contain the same value.
        //
        // Example:
        //
        // 1 = first entry only
        // 2 = first + second entry
        // 3 = first + second + third entry
        // ======================================================

        pyramidPositions:
          cleanPyramidPositions,

        maxPositions:
          cleanPyramidPositions,

        currentPositionCount:
          0,

        // ======================================================
        // ENTRY STATE
        // ======================================================

        firstEntryPrice:
          null,

        averageEntryPrice:
          null,

        // ======================================================
        // TP/SL STATE
        // ======================================================

        originalStopLoss:
          null,

        currentTakeProfit:
          null,

        currentTpOrderId:
          null,

        // ======================================================
        // INDIVIDUAL TRADE RECORDS
        // ======================================================

        trades:
          [],

        // ======================================================
        // BOT STATUS
        // ======================================================

        status:
          "ACTIVE",

        createdAt:
          new Date().toISOString(),
      };

      bots.push(
        bot
      );

      console.log(
        `[Bot] Created ${bot.name} | ${bot.symbol} | ${bot.direction} | Pyramid=${bot.pyramidPositions}`
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
    // PREVENT SECOND ENTRY WHILE 30 SECOND LIFECYCLE IS RUNNING
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

    // ----------------------------------------------------------
    // MAX POSITION CHECK
    // ----------------------------------------------------------
    //
    // pyramidPositions is the official value.
    //
    // maxPositions remains supported for older bots.
    // ----------------------------------------------------------

    const currentCount =
      Number(
        bot.currentPositionCount || 0
      );

    const maxPositions =
      Number(
        bot.pyramidPositions ||
        bot.maxPositions ||
        1
      );

    if (
      currentCount >=
      maxPositions
    ) {
      return res.status(400).json({
        success:
          false,

        error:
          `Maximum positions reached (${maxPositions}/${maxPositions})`,
      });
    }

    // ----------------------------------------------------------
    // NEXT TRADE NUMBER
    // ----------------------------------------------------------

    const tradeNumber =
      currentCount + 1;

    try {
      console.log(
        `[Bot:${bot.name}] ENTER ${bot.direction} ${bot.symbol} | Trade #${tradeNumber}/${maxPositions}`
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
        `[Bot:${bot.name}] Trade #${tradeNumber} position opened`
      );

      // --------------------------------------------------------
      // RECORD TRADE
      // --------------------------------------------------------

      const trade = {
        number:
          tradeNumber,

        direction:
          bot.direction,

        entryPrice:
          null,

        averageEntryPrice:
          null,

        stopLoss:
          null,

        takeProfit:
          null,

        timestamp:
          new Date().toISOString(),

        status:
          "OPEN",

        execution:
          entryResult,
      };

      bot.trades.push(
        trade
      );

      bot.currentPositionCount =
        tradeNumber;

      // --------------------------------------------------------
      // START 30 SECOND LIFECYCLE
      // --------------------------------------------------------

      const timer =
        setTimeout(
          async () => {
            try {
              console.log(
                `[Bot:${bot.name}] Trade #${tradeNumber} | 30 seconds complete`
              );

              // =================================================
              // FIRST ENTRY
              // =================================================
              //
              // Create:
              //
              //   original SL
              //   current TP
              //
              // =================================================

              const isFirstEntry =
                tradeNumber ===
                1;

              // =================================================
              // LATER ENTRY
              // =================================================
              //
              // Keep:
              //
              //   original SL
              //
              // Recalculate:
              //
              //   TP from current average entry
              //
              // =================================================

              const tpSlResult =
                await orders.updateTestTpSl(
                  bot.symbol,
                  bot.stopLoss,
                  bot.takeProfit,
                  {
                    keepOriginalSl:
                      !isFirstEntry,

                    originalStopLoss:
                      bot.originalStopLoss,

                    previousTpOrderId:
                      bot.currentTpOrderId,
                  }
                );

              // ------------------------------------------------
              // READ ACTUAL WEEX POSITION
              // ------------------------------------------------

              try {
                const positionResult =
                  await positions.getAll();

                const positionData =
                  Array.isArray(
                    positionResult?.data
                  )
                    ? positionResult.data
                    : [];

                const matchingPosition =
                  positionData.find(
                    (position) => {
                      const positionSymbol =
                        String(
                          position?.symbol ||
                          position?.contract ||
                          position?.instId ||
                          ""
                        )
                          .toUpperCase()
                          .trim();

                      const positionSize =
                        Number(
                          position?.size ||
                          position?.positionSize ||
                          position?.available ||
                          0
                        );

                      return (
                        positionSymbol ===
                          bot.symbol &&
                        Number.isFinite(
                          positionSize
                        ) &&
                        Math.abs(
                          positionSize
                        ) >
                          0
                      );
                    }
                  );

                if (
                  matchingPosition
                ) {
                  const averageEntry =
                    Number(
                      matchingPosition?.averageEntryPrice ||
                      matchingPosition?.avgOpenPrice ||
                      matchingPosition?.entryPrice ||
                      0
                    );

                  if (
                    Number.isFinite(
                      averageEntry
                    ) &&
                    averageEntry > 0
                  ) {
                    bot.averageEntryPrice =
                      averageEntry;

                    // ------------------------------------------
                    // Trade #1 = FIRST ENTRY
                    // ------------------------------------------

                    if (
                      tradeNumber ===
                      1
                    ) {
                      bot.firstEntryPrice =
                        averageEntry;
                    }

                    trade.entryPrice =
                      averageEntry;

                    trade.averageEntryPrice =
                      averageEntry;
                  }
                }
              } catch (
                positionSyncError
              ) {
                console.error(
                  `[Bot:${bot.name}] Position sync error:`,
                  positionSyncError
                );
              }

              // =================================================
              // STORE TP/SL STATE
              // =================================================

              if (
                tpSlResult
              ) {
                // ------------------------------------------------
                // Average entry
                // ------------------------------------------------

                if (
                  Number.isFinite(
                    Number(
                      tpSlResult.entryPrice
                    )
                  )
                ) {
                  bot.averageEntryPrice =
                    Number(
                      tpSlResult.entryPrice
                    );

                  trade.averageEntryPrice =
                    Number(
                      tpSlResult.entryPrice
                    );

                  // On trade #1 this is also the first entry.
                  if (
                    tradeNumber ===
                    1
                  ) {
                    bot.firstEntryPrice =
                      Number(
                        tpSlResult.entryPrice
                      );

                    trade.entryPrice =
                      Number(
                        tpSlResult.entryPrice
                      );
                  }
                }

                // ------------------------------------------------
                // ORIGINAL SL
                //
                // ONLY trade #1 is allowed to create the anchor.
                // ------------------------------------------------

                if (
                  tradeNumber ===
                  1 &&
                  Number.isFinite(
                    Number(
                      tpSlResult.stopLoss
                    )
                  )
                ) {
                  bot.originalStopLoss =
                    Number(
                      tpSlResult.stopLoss
                    );
                }

                // ------------------------------------------------
                // Current TP
                //
                // This changes after trade #2/#3.
                // ------------------------------------------------

                if (
                  Number.isFinite(
                    Number(
                      tpSlResult.takeProfit
                    )
                  )
                ) {
                  bot.currentTakeProfit =
                    Number(
                      tpSlResult.takeProfit
                    );
                }

                // ------------------------------------------------
                // TP ORDER ID
                // ------------------------------------------------

                if (
                  tpSlResult.tpOrderId
                ) {
                  bot.currentTpOrderId =
                    String(
                      tpSlResult.tpOrderId
                    );
                }

                // ------------------------------------------------
                // Store trade-level SL / TP
                // ------------------------------------------------

                trade.stopLoss =
                  Number(
                    bot.originalStopLoss ||
                    tpSlResult.stopLoss ||
                    0
                  );

                trade.takeProfit =
                  Number(
                    tpSlResult.takeProfit ||
                    0
                  );
              }

              // =================================================
              // FINAL STATE LOG
              // =================================================

              console.log(
                `[Bot:${bot.name}] Trade #${tradeNumber} TP/SL lifecycle complete`
              );

              console.log(
                `[Bot:${bot.name}] State | positions=${bot.currentPositionCount}/${maxPositions} | firstEntry=${bot.firstEntryPrice} | averageEntry=${bot.averageEntryPrice} | originalSL=${bot.originalStopLoss} | currentTP=${bot.currentTakeProfit} | tpOrderId=${bot.currentTpOrderId}`
              );

              console.log(
                `[Bot:${bot.name}] Trade #${tradeNumber} | entry=${trade.entryPrice} | average=${trade.averageEntryPrice} | SL=${trade.stopLoss} | TP=${trade.takeProfit}`
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

      // ========================================================
      // IMMEDIATE RESPONSE
      // ========================================================

      res.json({
        success:
          true,

        message:
          `Trade #${tradeNumber} opened. TP/SL lifecycle will run in 30 seconds.`,

        data: {
          botId:
            bot.id,

          botName:
            bot.name,

          symbol:
            bot.symbol,

          direction:
            bot.direction,

          tradeNumber:
            tradeNumber,

          currentPositionCount:
            bot.currentPositionCount,

          pyramidPositions:
            bot.pyramidPositions,

          maxPositions:
            bot.maxPositions,

          firstEntryPrice:
            bot.firstEntryPrice,

          averageEntryPrice:
            bot.averageEntryPrice,

          originalStopLoss:
            bot.originalStopLoss,

          currentTakeProfit:
            bot.currentTakeProfit,

          currentTpOrderId:
            bot.currentTpOrderId,

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
      // CANCEL PENDING TIMER
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
      // CLOSE ACTUAL POSITION
      // --------------------------------------------------------

      const result =
        await orders.closeTestPosition(
          bot.symbol
        );

      console.log(
        `[Bot:${bot.name}] Position closed`
      );

      // --------------------------------------------------------
      // CLEAR TRACKED TP
      // --------------------------------------------------------

      if (
        typeof orders.clearTrackedTp ===
        "function"
      ) {
        orders.clearTrackedTp(
          bot.symbol
        );
      }

      // --------------------------------------------------------
      // RESET BOT POSITION STATE
      // --------------------------------------------------------

      bot.currentPositionCount =
        0;

      bot.firstEntryPrice =
        null;

      bot.averageEntryPrice =
        null;

      bot.originalStopLoss =
        null;

      bot.currentTakeProfit =
        null;

      bot.currentTpOrderId =
        null;

      bot.trades =
        [];

      res.json({
        success:
          true,

        message:
          "Position closed",

        data:
          result,

        botState: {
          currentPositionCount:
            bot.currentPositionCount,

          pyramidPositions:
            bot.pyramidPositions,

          maxPositions:
            bot.maxPositions,

          firstEntryPrice:
            bot.firstEntryPrice,

          averageEntryPrice:
            bot.averageEntryPrice,

          originalStopLoss:
            bot.originalStopLoss,

          currentTakeProfit:
            bot.currentTakeProfit,

          currentTpOrderId:
            bot.currentTpOrderId,

          trades:
            bot.trades,
        },
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
      // CANCEL TIMER
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

      // --------------------------------------------------------
      // CLEAR TRACKED TP
      // --------------------------------------------------------

      if (
        deletedBot?.symbol &&
        typeof orders.clearTrackedTp ===
          "function"
      ) {
        orders.clearTrackedTp(
          deletedBot.symbol
        );
      }

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

