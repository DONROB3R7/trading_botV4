const express = require("express");

const router = express.Router();

// ============================================================
// IN-MEMORY BOT STORAGE
// ============================================================

const bots = [];
const botTimers = new Map();
const triggerTimers = new Map();

// ============================================================
// TIMING
// ============================================================

const TP_SL_DELAY_MS = 30 * 1000;
const TRIGGER_CHECK_MS = 30 * 1000;

// ============================================================
// WEEX
// ============================================================

const WEEX_BASE_URL =
  process.env.WEEX_BASE_URL ||
  "https://api-contract.weex.com";

// ============================================================
// HELPERS
// ============================================================

function makeId() {
  return `bot_${Date.now()}`;
}

function cleanString(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return number;
}

function cleanDirection(value) {
  return String(value || "LONG").toUpperCase() === "SHORT"
    ? "SHORT"
    : "LONG";
}

function cleanTriggerLineEnabled(value) {
  return value === true;
}

// ============================================================
// IMPORTANT TRIGGER RULE
//
// Trigger Line ENABLED
//      -> NEUTRAL
//
// Trigger Line DISABLED
//      -> ARMED
//
// There is NO "OFF" state anymore.
// ============================================================

function cleanTriggerState(value, enabled) {
  if (!enabled) {
    return "ARMED";
  }

  return value === "ARMED"
    ? "ARMED"
    : "NEUTRAL";
}

// ============================================================
// PRICE EXTRACTION
// ============================================================

function extractPrice(result) {
  if (result === undefined || result === null) {
    return null;
  }

  // Direct number
  if (typeof result === "number") {
    return Number.isFinite(result)
      ? result
      : null;
  }

  // String number
  if (typeof result === "string") {
    const number = Number(result);

    return Number.isFinite(number)
      ? number
      : null;
  }

  // Object
  if (typeof result === "object") {
    const candidates = [
      result.price,
      result.lastPrice,
      result.markPrice,
      result.indexPrice,

      result.data?.price,
      result.data?.lastPrice,
      result.data?.markPrice,
      result.data?.indexPrice,
    ];

    for (const candidate of candidates) {
      const number = Number(candidate);

      if (Number.isFinite(number)) {
        return number;
      }
    }

    // Array inside data
    if (Array.isArray(result.data)) {
      for (const item of result.data) {
        const number = extractPrice(item);

        if (Number.isFinite(number)) {
          return number;
        }
      }
    }

    // Direct array
    if (Array.isArray(result)) {
      for (const item of result) {
        const number = extractPrice(item);

        if (Number.isFinite(number)) {
          return number;
        }
      }
    }
  }

  return null;
}

// ============================================================
// GET CURRENT WEEX PRICE
// ============================================================

async function getCurrentMarketPrice(symbol) {
  const cleanSymbolValue = String(symbol || "")
    .trim()
    .toUpperCase();

  if (!cleanSymbolValue) {
    throw new Error("Missing symbol");
  }

  // ==========================================================
  // WEEX V3 SYMBOL PRICE
  // ==========================================================

  const url =
    `${WEEX_BASE_URL}/capi/v3/market/symbolPrice` +
    `?symbol=${encodeURIComponent(cleanSymbolValue)}` +
    `&priceType=INDEX`;

  console.log(`[WEEX] GET ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `WEEX symbolPrice HTTP ${response.status}`
    );
  }

  const data = await response.json();

  const price = extractPrice(data);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(
      `Invalid WEEX symbolPrice response: ${JSON.stringify(data)}`
    );
  }

  return price;
}

// ============================================================
// TRIGGER TOUCH / CROSS CHECK
// ============================================================

function hasTriggerLineTouched(
  previousPrice,
  currentPrice,
  triggerPrice
) {
  if (
    !Number.isFinite(previousPrice) ||
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(triggerPrice)
  ) {
    return false;
  }

  // Exact touch
  if (currentPrice === triggerPrice) {
    return true;
  }

  if (previousPrice === triggerPrice) {
    return true;
  }

  // Cross upward
  if (
    previousPrice < triggerPrice &&
    currentPrice > triggerPrice
  ) {
    return true;
  }

  // Cross downward
  if (
    previousPrice > triggerPrice &&
    currentPrice < triggerPrice
  ) {
    return true;
  }

  return false;
}

// ============================================================
// STOP TRIGGER MONITOR
// ============================================================

function stopTriggerMonitor(bot) {
  if (!bot) {
    return;
  }

  const timer = triggerTimers.get(bot.id);

  if (timer) {
    clearInterval(timer);
    triggerTimers.delete(bot.id);
  }
}

// ============================================================
// START TRIGGER MONITOR
// ============================================================

function startTriggerMonitor(bot) {
  if (!bot) {
    return;
  }

  if (bot.triggerLineEnabled !== true) {
    return;
  }

  if (bot.triggerState === "ARMED") {
    return;
  }

  // Prevent duplicate timers
  stopTriggerMonitor(bot);

  console.log(
    `[Trigger:${bot.symbol}] Monitor started | ` +
    `Trigger=${bot.triggerLinePrice} | ` +
    `Baseline=${bot.triggerLastPrice}`
  );

  const timer = setInterval(async () => {
    try {
      // --------------------------------------------------------
      // Trigger disabled
      // --------------------------------------------------------

      if (bot.triggerLineEnabled !== true) {
        stopTriggerMonitor(bot);
        return;
      }

      // --------------------------------------------------------
      // Already armed
      //
      // NEVER go back to neutral.
      // --------------------------------------------------------

      if (bot.triggerState === "ARMED") {
        stopTriggerMonitor(bot);
        return;
      }

      const triggerPrice =
        Number(bot.triggerLinePrice);

      if (
        !Number.isFinite(triggerPrice) ||
        triggerPrice <= 0
      ) {
        console.log(
          `[Trigger:${bot.symbol}] Invalid trigger price`
        );

        return;
      }

      // --------------------------------------------------------
      // GET CURRENT PRICE
      // --------------------------------------------------------

      let currentPrice;

      try {
        currentPrice =
          await getCurrentMarketPrice(
            bot.symbol
          );
      } catch (error) {
        console.log(
          `[Trigger:${bot.symbol}] ` +
          `Price fetch failed: ${error.message}`
        );

        return;
      }

      if (
        !Number.isFinite(currentPrice) ||
        currentPrice <= 0
      ) {
        console.log(
          `[Trigger:${bot.symbol}] Invalid current price`
        );

        return;
      }

      const previousPrice =
        Number(bot.triggerLastPrice);

      console.log(
        `[Trigger:${bot.symbol}] Check | ` +
        `Previous=${previousPrice} | ` +
        `Current=${currentPrice} | ` +
        `Trigger=${triggerPrice}`
      );

      // --------------------------------------------------------
      // NO BASELINE
      // --------------------------------------------------------

      if (
        !Number.isFinite(previousPrice) ||
        previousPrice <= 0
      ) {
        bot.triggerLastPrice =
          currentPrice;

        console.log(
          `[Trigger:${bot.symbol}] ` +
          `Baseline initialized=${currentPrice}`
        );

        return;
      }

      // --------------------------------------------------------
      // CHECK TOUCH / CROSS
      // --------------------------------------------------------

      const touched =
        hasTriggerLineTouched(
          previousPrice,
          currentPrice,
          triggerPrice
        );

      // --------------------------------------------------------
      // TRIGGER HIT
      // --------------------------------------------------------

      if (touched) {
        bot.triggerState = "ARMED";

        bot.triggerArmedAt =
          new Date().toISOString();

        bot.triggerArmedPrice =
          currentPrice;

        bot.triggerLastPrice =
          currentPrice;

        console.log(
          `[Trigger:${bot.symbol}] ` +
          `TRIGGER ARMED | ` +
          `Previous=${previousPrice} | ` +
          `Current=${currentPrice} | ` +
          `Trigger=${triggerPrice}`
        );

        // Stop checking.
        //
        // ARMED stays ARMED forever.
        stopTriggerMonitor(bot);

        return;
      }

      // --------------------------------------------------------
      // NOT TOUCHED
      //
      // Current valid price becomes next baseline.
      // --------------------------------------------------------

      bot.triggerLastPrice =
        currentPrice;
    } catch (error) {
      console.error(
        `[Trigger:${bot.symbol}] Monitor error:`,
        error.message
      );
    }
  }, TRIGGER_CHECK_MS);

  triggerTimers.set(
    bot.id,
    timer
  );
}

// ============================================================
// FACTORY
// ============================================================

module.exports = function createBotsRouter({
  orders,
  positions,
}) {

  // ==========================================================
  // GET ALL BOTS
  // ==========================================================

  router.get("/", (req, res) => {

    console.log(
      `[Bot] GET /api/bots | Count=${bots.length}`
    );

    return res.json(
      bots
    );

  });

  // ==========================================================
  // CREATE BOT
  // ==========================================================

  router.post("/", async (req, res) => {

    try {

      const body =
        req.body || {};

      // ------------------------------------------------------
      // BASIC BOT DATA
      // ------------------------------------------------------

      const cleanName =
        cleanString(
          body.name,
          `Bot ${bots.length + 1}`
        );

      const cleanSymbol =
        cleanString(
          body.symbol
        ).toUpperCase();

      if (!cleanSymbol) {

        return res.status(400).json({
          success: false,
          error: "Symbol is required",
        });

      }

      const botDirection =
        cleanDirection(
          body.direction
        );

      const cleanEntryModel =
        cleanString(
          body.entryModel,
          "BUTTON_PRESS"
        );

      const cleanStopLoss =
        cleanNumber(
          body.stopLoss,
          0
        );

      const cleanTakeProfit =
        cleanNumber(
          body.takeProfit,
          0
        );

      // ------------------------------------------------------
      // PYRAMID
      // ------------------------------------------------------

      const cleanPyramidPositions =
        Math.max(
          1,
          Math.min(
            3,
            Math.floor(
              cleanNumber(
                body.pyramidPositions,
                1
              )
            )
          )
        );

      // ======================================================
      // TRIGGER LINE
      // ======================================================

      const triggerLineEnabled =
        cleanTriggerLineEnabled(
          body.triggerLineEnabled
        );

      const triggerLinePrice =
        cleanNumber(
          body.triggerLinePrice,
          0
        );

      // ------------------------------------------------------
      // TRIGGER PRICE ONLY REQUIRED WHEN ENABLED
      // ------------------------------------------------------

      if (
        triggerLineEnabled &&
        (
          !Number.isFinite(
            triggerLinePrice
          ) ||
          triggerLinePrice <= 0
        )
      ) {

        return res.status(400).json({
          success: false,
          error:
            "Trigger Line is enabled but trigger price is invalid",
        });

      }

      // ======================================================
      // INITIAL TRIGGER STATE
      //
      // ENABLED  -> NEUTRAL
      // DISABLED -> ARMED
      // ======================================================

      let initialTriggerPrice =
        null;

      let initialTriggerState =
        cleanTriggerState(
          null,
          triggerLineEnabled
        );

      let triggerArmedAt =
        null;

      let triggerArmedPrice =
        null;

      // ======================================================
      // TRIGGER LINE ENABLED
      //
      // Get initial price and start NEUTRAL.
      // ======================================================

      if (triggerLineEnabled) {

        initialTriggerState =
          "NEUTRAL";

        try {

          initialTriggerPrice =
            await getCurrentMarketPrice(
              cleanSymbol
            );

          console.log(
            `[Trigger:${cleanSymbol}] ` +
            `Creation baseline=${initialTriggerPrice} | ` +
            `Trigger=${triggerLinePrice}`
          );

          // --------------------------------------------------
          // EXACTLY ON LINE AT CREATION
          // --------------------------------------------------

          if (
            initialTriggerPrice ===
            triggerLinePrice
          ) {

            initialTriggerState =
              "ARMED";

            triggerArmedAt =
              new Date().toISOString();

            triggerArmedPrice =
              initialTriggerPrice;

            console.log(
              `[Trigger:${cleanSymbol}] ` +
              `ARMED IMMEDIATELY AT CREATION`
            );

          }

        } catch (error) {

          console.error(
            `[Trigger:${cleanSymbol}] ` +
            `Could not get current market price:`,
            error.message
          );

          return res.status(502).json({
            success: false,
            error:
              `Could not get current market price for ${cleanSymbol}: ${error.message}`,
          });

        }

      } else {

        // ====================================================
        // TRIGGER LINE DISABLED
        //
        // BOT IS READY IMMEDIATELY.
        // ====================================================

        initialTriggerState =
          "ARMED";

        console.log(
          `[Trigger:${cleanSymbol}] ` +
          `Trigger Line disabled | ` +
          `Bot starts ARMED`
        );

      }

      // ======================================================
      // BOT OBJECT
      // ======================================================

      const bot = {

        id:
          makeId(),

        name:
          cleanName,

        symbol:
          cleanSymbol,

        direction:
          botDirection,

        entryModel:
          cleanEntryModel,

        stopLoss:
          cleanStopLoss,

        takeProfit:
          cleanTakeProfit,

        pyramidPositions:
          cleanPyramidPositions,

        maxPositions:
          cleanPyramidPositions,

        currentPositionCount:
          0,

        firstEntryPrice:
          null,

        averageEntryPrice:
          null,

        originalStopLoss:
          null,

        currentTakeProfit:
          null,

        currentTpOrderId:
          null,

        trades:
          [],

        status:
          "ACTIVE",

        createdAt:
          new Date().toISOString(),

        // ====================================================
        // TRIGGER LINE
        // ====================================================

        triggerLineEnabled,

        triggerLinePrice:
          triggerLineEnabled
            ? triggerLinePrice
            : null,

        triggerState:
          initialTriggerState,

        // Price captured when trigger bot was created.
        // For a bot without Trigger Line this remains null.
        triggerLastPrice:
          initialTriggerPrice,

        triggerArmedAt,

        triggerArmedPrice,
      };

      bots.push(
        bot
      );

      // ======================================================
      // LOG
      // ======================================================

      console.log(
        `[Bot] Created ${bot.name} | ` +
        `${bot.symbol} | ` +
        `${bot.direction} | ` +
        `Pyramid=${bot.pyramidPositions}`
      );

      console.log(
        `[Bot] Trigger | ` +
        `Enabled=${bot.triggerLineEnabled} | ` +
        `Price=${bot.triggerLinePrice} | ` +
        `State=${bot.triggerState} | ` +
        `Baseline=${bot.triggerLastPrice}`
      );

      // ======================================================
      // START TRIGGER MONITOR
      //
      // Only Trigger Line bots in NEUTRAL need monitoring.
      // ======================================================

      if (
        bot.triggerLineEnabled === true &&
        bot.triggerState === "NEUTRAL"
      ) {

        startTriggerMonitor(
          bot
        );

      }

      return res.status(201).json({
        success:
          true,

        bot,
      });

    } catch (error) {

      console.error(
        "[Bot] Create error:",
        error
      );

      return res.status(500).json({
        success:
          false,

        error:
          error.message,
      });

    }

  });

  // ==========================================================
  // ENTER
  // ==========================================================

  router.post("/:id/enter", async (req, res) => {

    const bot =
      bots.find(
        (item) =>
          item.id === req.params.id
      );

    if (!bot) {

      return res.status(404).json({
        success: false,
        error: "Bot not found",
      });

    }

    // --------------------------------------------------------
    // BOT STATUS
    // --------------------------------------------------------

    if (
      bot.status !== "ACTIVE"
    ) {

      return res.status(400).json({
        success: false,
        error: "Bot is not active",
      });

    }

    // --------------------------------------------------------
    // TRIGGER GATE
    // --------------------------------------------------------

    if (
      bot.triggerLineEnabled === true &&
      bot.triggerState === "NEUTRAL"
    ) {

      return res.status(400).json({
        success: false,

        error:
          "ENTRY BLOCKED — Bot is NEUTRAL. Trigger Line has not been activated.",

        triggerState:
          bot.triggerState,

        triggerLinePrice:
          bot.triggerLinePrice,
      });

    }

    // --------------------------------------------------------
    // TP/SL TIMER
    // --------------------------------------------------------

    if (
      botTimers.has(
        bot.id
      )
    ) {

      return res.status(400).json({
        success: false,

        error:
          "TP/SL protection is still being prepared for the previous entry.",
      });

    }

    // --------------------------------------------------------
    // PYRAMID LIMIT
    // --------------------------------------------------------

    if (
      bot.currentPositionCount >=
      bot.maxPositions
    ) {

      return res.status(400).json({
        success: false,

        error:
          "Maximum pyramid positions reached.",
      });

    }

    const tradeNumber =
      bot.currentPositionCount + 1;

    const isFirstEntry =
      tradeNumber === 1;

    try {

      // ======================================================
      // OPEN
      // ======================================================

      console.log(
        `[Bot:${bot.symbol}] ` +
        `ENTER ${bot.direction} | ` +
        `Trade #${tradeNumber}`
      );

      const openResult =
        await orders.openTestPosition(
          bot.symbol,
          bot.direction
        );

      // ======================================================
      // TRADE
      // ======================================================

      const trade = {

        tradeNumber,

        direction:
          bot.direction,

        openedAt:
          new Date().toISOString(),

        openResult,

        stopLoss:
          bot.stopLoss,

        takeProfit:
          bot.takeProfit,

        status:
          "OPEN",
      };

      bot.trades.push(
        trade
      );

      bot.currentPositionCount =
        tradeNumber;

      // ======================================================
      // TP/SL 30 SECOND DELAY
      // ======================================================

      console.log(
        `[Bot:${bot.symbol}] ` +
        `TP/SL sync scheduled in 30 seconds | ` +
        `Trade #${tradeNumber}`
      );

      const timer =
        setTimeout(
          async () => {

            try {

              console.log(
                `[Bot:${bot.symbol}] ` +
                `30s TP/SL sync START | ` +
                `Trade #${tradeNumber}`
              );

              // ==============================================
              // UPDATE TP/SL
              // ==============================================

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

              console.log(
                `[Bot:${bot.symbol}] ` +
                `TP/SL sync result:`,
                tpSlResult
              );

              // ==============================================
              // GET LIVE POSITION
              // ==============================================

              let livePosition =
                null;

              try {

                const allPositions =
                  await positions.getAll();

                if (
                  Array.isArray(
                    allPositions
                  )
                ) {

                  livePosition =
                    allPositions.find(
                      (position) => {

                        const positionSymbol =
                          String(
                            position.symbol ||
                            position.contract ||
                            ""
                          ).toUpperCase();

                        return (
                          positionSymbol ===
                          bot.symbol
                        );

                      }
                    );

                }

              } catch (positionError) {

                console.error(
                  `[Bot:${bot.symbol}] ` +
                  `Position sync failed:`,
                  positionError.message
                );

              }

              // ==============================================
              // ENTRY PRICE
              // ==============================================

              const liveAverageEntry =
                livePosition
                  ? cleanNumber(
                      livePosition.avgEntryPrice ??
                      livePosition.averageEntryPrice ??
                      livePosition.entryPrice,
                      0
                    )
                  : 0;

              const liveEntryPrice =
                liveAverageEntry > 0
                  ? liveAverageEntry
                  : cleanNumber(
                      openResult?.entryPrice ??
                      openResult?.price ??
                      openResult?.data?.entryPrice ??
                      openResult?.data?.price,
                      0
                    );

              // ==============================================
              // FIRST ENTRY
              // ==============================================

              if (isFirstEntry) {

                bot.firstEntryPrice =
                  liveEntryPrice > 0
                    ? liveEntryPrice
                    : null;

                bot.originalStopLoss =
                  bot.stopLoss;

              }

              // ==============================================
              // AVERAGE ENTRY
              // ==============================================

              bot.averageEntryPrice =
                liveEntryPrice > 0
                  ? liveEntryPrice
                  : bot.averageEntryPrice;

              // ==============================================
              // CURRENT TP
              // ==============================================

              bot.currentTakeProfit =
                bot.takeProfit;

              // ==============================================
              // TP ORDER ID
              //
              // ALWAYS STRING
              // ==============================================

              if (
                tpSlResult &&
                tpSlResult.tpOrderId !==
                  undefined &&
                tpSlResult.tpOrderId !==
                  null
              ) {

                bot.currentTpOrderId =
                  String(
                    tpSlResult.tpOrderId
                  );

              }

              // ==============================================
              // UPDATE TRADE
              // ==============================================

              trade.entryPrice =
                bot.averageEntryPrice;

              trade.stopLoss =
                bot.originalStopLoss;

              trade.takeProfit =
                bot.currentTakeProfit;

              trade.tpOrderId =
                bot.currentTpOrderId;

              trade.protectionSyncedAt =
                new Date().toISOString();

              console.log(
                `[Bot:${bot.symbol}] ` +
                `TP/SL protection synced | ` +
                `Trade #${tradeNumber} | ` +
                `Entry=${bot.averageEntryPrice} | ` +
                `SL=${trade.stopLoss} | ` +
                `TP=${trade.takeProfit} | ` +
                `TPOrder=${trade.tpOrderId}`
              );

            } catch (error) {

              console.error(
                `[Bot:${bot.symbol}] ` +
                `TP/SL sync ERROR:`,
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

      return res.json({

        success:
          true,

        bot,

        trade,

        triggerState:
          bot.triggerState,

        triggerLinePrice:
          bot.triggerLinePrice,

      });

    } catch (error) {

      console.error(
        `[Bot:${bot.symbol}] ENTER ERROR:`,
        error
      );

      return res.status(500).json({
        success:
          false,

        error:
          error.message,
      });

    }

  });

  // ==========================================================
  // CLOSE
  // ==========================================================

  router.post("/:id/close", async (req, res) => {

    const bot =
      bots.find(
        (item) =>
          item.id === req.params.id
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

      // ------------------------------------------------------
      // CANCEL TP/SL TIMER
      // ------------------------------------------------------

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

      }

      // ------------------------------------------------------
      // CLOSE POSITION
      // ------------------------------------------------------

      const closeResult =
        await orders.closeTestPosition(
          bot.symbol
        );

      // ------------------------------------------------------
      // CANCEL TRACKED TP
      // ------------------------------------------------------

      if (
        bot.currentTpOrderId &&
        typeof orders.cancelTpOrder ===
          "function"
      ) {

        try {

          await orders.cancelTpOrder(
            bot.currentTpOrderId
          );

        } catch (error) {

          console.error(
            `[Bot:${bot.symbol}] ` +
            `TP cancel failed:`,
            error.message
          );

        }

      }

      // ------------------------------------------------------
      // RESET POSITION STATE
      //
      // DO NOT RESET TRIGGER STATE.
      // ------------------------------------------------------

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

      console.log(
        `[Bot:${bot.symbol}] ` +
        `POSITION CLOSED | ` +
        `TriggerState=${bot.triggerState}`
      );

      return res.json({

        success:
          true,

        closeResult,

        bot,

        triggerState:
          bot.triggerState,

      });

    } catch (error) {

      console.error(
        `[Bot:${bot.symbol}] CLOSE ERROR:`,
        error
      );

      return res.status(500).json({

        success:
          false,

        error:
          error.message,

      });

    }

  });

  // ==========================================================
  // PAUSE
  // ==========================================================

  router.post("/:id/pause", (req, res) => {

    const bot =
      bots.find(
        (item) =>
          item.id === req.params.id
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

    return res.json({

      success:
        true,

      bot,

    });

  });

  // ==========================================================
  // RESUME
  // ==========================================================

  router.post("/:id/resume", (req, res) => {

    const bot =
      bots.find(
        (item) =>
          item.id === req.params.id
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

    // --------------------------------------------------------
    // Trigger remains whatever it was.
    //
    // NEUTRAL -> restart monitor
    // ARMED   -> remain ARMED
    // --------------------------------------------------------

    if (
      bot.triggerLineEnabled === true &&
      bot.triggerState === "NEUTRAL"
    ) {

      startTriggerMonitor(
        bot
      );

    }

    return res.json({

      success:
        true,

      bot,

    });

  });

  // ==========================================================
  // DELETE
  // ==========================================================

  router.delete("/:id", (req, res) => {

    const index =
      bots.findIndex(
        (item) =>
          item.id === req.params.id
      );

    if (index === -1) {

      return res.status(404).json({
        success:
          false,

        error:
          "Bot not found",
      });

    }

    const bot =
      bots[index];

    // --------------------------------------------------------
    // STOP TP/SL TIMER
    // --------------------------------------------------------

    const tpTimer =
      botTimers.get(
        bot.id
      );

    if (tpTimer) {

      clearTimeout(
        tpTimer
      );

      botTimers.delete(
        bot.id
      );

    }

    // --------------------------------------------------------
    // STOP TRIGGER TIMER
    // --------------------------------------------------------

    stopTriggerMonitor(
      bot
    );

    // --------------------------------------------------------
    // DELETE
    // --------------------------------------------------------

    bots.splice(
      index,
      1
    );

    console.log(
      `[Bot] Deleted ${bot.name} | ${bot.symbol}`
    );

    return res.json({

      success:
        true,

      deletedBotId:
        bot.id,

    });

  });

  // ==========================================================
  // RETURN ROUTER
  // ==========================================================

  return router;
};