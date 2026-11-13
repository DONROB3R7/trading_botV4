
const express = require("express");
const router = express.Router();

// ============================================================
// IMPORTS
// ============================================================

const BotAdvanced = require("./botAdvanced");
const BotEntry = require("./botEntry");
const BotEntryModel = require("./botEntryModel");
const BotModels = require("./botModels");

const tradeCycleManager =
  require("../cycle/tradeCycleManager");

const tradeLifecycle =
  require("../lifecycle/tradeLifecycle");

const entryModelEngine =
  require("../entry-models/entryModelEngine");

const PriceModelManager =
  require("../entry-models/priceModelManager");

const CombinedEntryModelManager =
  require("../entry-models/combinedEntryModelManager");

// ============================================================
// BOT STORAGE AND SERVICES
// ============================================================

const bots = [];

const advanced = new BotAdvanced();
const botEntry = new BotEntry();
const botEntryModel = new BotEntryModel();

const priceModelManager =
  new PriceModelManager();

const combinedEntryModelManager =
  new CombinedEntryModelManager();

const botModels = new BotModels({
  bots,
  priceModelManager,
  combinedEntryModelManager,
});

// ============================================================
// MODEL ROUTES
// ============================================================

router.get("/:botId/price-model", (req, res) => {
  const result =
    botModels.getPriceModel(req.params.botId);

  return res.status(result.status).json(result.body);
});

router.get("/:botId/combined-entry-model", (req, res) => {
  const result =
    botModels.getCombinedEntryModel(req.params.botId);

  return res.status(result.status).json(result.body);
});

router.post(
  "/:botId/combined-entry-model/start",
  async (req, res) => {
    const result =
      await botModels.startCombinedEntryModel(
        req.params.botId
      );

    return res.status(result.status).json(result.body);
  }
);

router.post(
  "/:botId/combined-entry-model/stop",
  async (req, res) => {
    const result =
      await botModels.stopCombinedEntryModel(
        req.params.botId
      );

    return res.status(result.status).json(result.body);
  }
);

router.post(
  "/:botId/price-model/start",
  async (req, res) => {
    const result =
      await botModels.startPriceModel(
        req.params.botId
      );

    return res.status(result.status).json(result.body);
  }
);

router.post(
  "/:botId/price-model/stop",
  (req, res) => {
    const result =
      botModels.stopPriceModel(req.params.botId);

    return res.status(result.status).json(result.body);
  }
);

router.post(
  "/:botId/price-model/bias",
  (req, res) => {
    const result =
      botModels.setPriceModelBias(
        req.params.botId,
        req.body?.bias
      );

    return res.status(result.status).json(result.body);
  }
);

router.post(
  "/:botId/price-model/scan",
  async (req, res) => {
    const result =
      await botModels.scanPriceModel(req.params.botId);

    return res.status(result.status).json(result.body);
  }
);

// ============================================================
// ROUTER FACTORY
// ============================================================

module.exports = function createBotsRouter({
  orders,
  positions,
}) {
  // ==========================================================
  // CONFIGURE SERVICES
  // ==========================================================

  tradeLifecycle.configure({
    orders,
    positions,
  });

  botModels.configureEntryExecution({
    botEntry,
    orders,
    positions,
    advanced,
  });

  tradeLifecycle.configureBotLookup((botId) => {
    return bots.find((bot) => bot.id === botId) || null;
  });

  // ==========================================================
  // GET ALL BOTS
  // ==========================================================

  router.get("/", (req, res) => {
    console.log(
      `[Bot] GET /api/bots | Count=${bots.length}`
    );

    return res.json(bots);
  });

  // ==========================================================
  // CREATE BOT
  // ==========================================================

  router.post("/", async (req, res) => {
    try {
      const body = req.body || {};

      // BASIC DATA

      const cleanName =
        advanced.cleanString(
          body.name,
          `Bot ${bots.length + 1}`
        );

      const cleanSymbol =
        advanced.cleanString(body.symbol).toUpperCase();

      if (!cleanSymbol) {
        return res.status(400).json({
          success: false,
          error: "Symbol is required",
        });
      }

      const botDirection =
        advanced.cleanDirection(body.direction);

      const cleanEntryModel =
        advanced.cleanString(
          body.entryModel,
          "BUTTON_PRESS"
        );

      const cleanStopLoss =
        advanced.cleanNumber(body.stopLoss, 0);

      const cleanTakeProfit =
        advanced.cleanNumber(body.takeProfit, 0);

      // ======================================================
      // RISK LEVEL
      // BASE = 1x
      // GOOD = 2x
      // EXTREME = 3x
      // ======================================================

      const riskMultipliers = {
        BASE: 1,
        GOOD: 2,
        EXTREME: 3,
      };

      const requestedRiskLevel =
        String(body.riskLevel || "BASE")
          .trim()
          .toUpperCase();

      if (
        !Object.prototype.hasOwnProperty.call(
          riskMultipliers,
          requestedRiskLevel
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid risk level. Allowed: BASE, GOOD, EXTREME",
        });
      }

      const cleanRiskLevel = requestedRiskLevel;

      // The backend chooses the multiplier.
      // Do not trust a multiplier supplied by the frontend.

      const cleanRiskMultiplier =
        riskMultipliers[cleanRiskLevel];

      // ======================================================
      // PYRAMID POSITIONS
      // ======================================================

      const cleanPyramidPositions =
        Math.max(
          1,
          Math.min(
            3,
            Math.floor(
              advanced.cleanNumber(
                body.pyramidPositions,
                1
              )
            )
          )
        );

      // ======================================================
      // CONSECUTIVE LOSS LIMIT
      // ======================================================

      const cleanConsecutiveLossLimit =
        Math.max(
          1,
          Math.min(
            10,
            Math.floor(
              advanced.cleanNumber(
                body.consecutiveLossLimit,
                1
              )
            )
          )
        );

      // ======================================================
      // PYRAMID POSITION MULTIPLIER
      // ======================================================

      const allowedMultipliers = [
        1,
        1.5,
        2,
        2.5,
        3,
      ];

      const requestedMultiplier =
        Number(body.pyramidPositionMultiplier ?? 1);

      const cleanPyramidPositionMultiplier =
        allowedMultipliers.includes(requestedMultiplier)
          ? requestedMultiplier
          : 1;

      // ======================================================
      // PYRAMID DISTANCE
      // ======================================================

      const cleanPyramidDistance =
        advanced.cleanNumber(body.pyramidDistance, 1);

      if (
        !Number.isFinite(cleanPyramidDistance) ||
        cleanPyramidDistance <= 0
      ) {
        return res.status(400).json({
          success: false,
          error: "Pyramid Distance must be greater than 0",
        });
      }

      // ======================================================
      // TRIGGER LINE
      // ======================================================

      const triggerLineEnabled =
        advanced.cleanTriggerLineEnabled(
          body.triggerLineEnabled
        );

      const triggerLinePrice =
        advanced.cleanNumber(body.triggerLinePrice, 0);

      if (
        triggerLineEnabled &&
        (
          !Number.isFinite(triggerLinePrice) ||
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
      // ======================================================

      let initialTriggerPrice = null;

      let initialTriggerState =
        advanced.cleanTriggerState(
          null,
          triggerLineEnabled
        );

      let triggerArmedAt = null;
      let triggerArmedPrice = null;

      if (triggerLineEnabled) {
        initialTriggerState = "NEUTRAL";

        try {
          initialTriggerPrice =
            await advanced.getCurrentMarketPrice(
              cleanSymbol
            );

          console.log(
            `[Trigger:${cleanSymbol}] ` +
              `Creation baseline=${initialTriggerPrice} | ` +
              `Trigger=${triggerLinePrice}`
          );

          if (initialTriggerPrice === triggerLinePrice) {
            initialTriggerState = "ARMED";
            triggerArmedAt = new Date().toISOString();
            triggerArmedPrice = initialTriggerPrice;

            console.log(
              `[Trigger:${cleanSymbol}] ARMED IMMEDIATELY AT CREATION`
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
        initialTriggerState = "ARMED";

        console.log(
          `[Trigger:${cleanSymbol}] ` +
            `Trigger Line disabled | Bot starts ARMED`
        );
      }

      // ======================================================
      // CREATE BOT
      // ======================================================

      const bot = botModels.createBot({
        id: `bot_${Date.now()}`,
        name: cleanName,
        symbol: cleanSymbol,
        direction: botDirection,
        entryModel: cleanEntryModel,
        stopLoss: cleanStopLoss,
        takeProfit: cleanTakeProfit,
        pyramidPositions: cleanPyramidPositions,
        consecutiveLossLimit:
                    cleanConsecutiveLossLimit,

        pyramidPositionMultiplier:
          cleanPyramidPositionMultiplier,

        pyramidDistance:
          cleanPyramidDistance,

        // RISK SETTINGS
        riskLevel: cleanRiskLevel,
        riskMultiplier: cleanRiskMultiplier,

        triggerLineEnabled,

        triggerLinePrice:
          triggerLineEnabled
            ? triggerLinePrice
            : null,

        triggerState: initialTriggerState,
        triggerLastPrice: initialTriggerPrice,
        triggerArmedAt,
        triggerArmedPrice,
        tradeLifecycle,
        entryModelEngine,
      });

      // ======================================================
      // STORE BOT
      // ======================================================

      bots.push(bot);

      // ======================================================
      // PRICE MODEL
      // ======================================================

      priceModelManager.getOrCreate(
        bot.id,
        bot.symbol,
        bot.direction
      );

      console.log(
        `[Bot:${bot.symbol}] Price Model created | ` +
          `Bot=${bot.id} | Direction=${bot.direction}`
      );

      // ======================================================
      // COMBINED ENTRY MODEL
      // ======================================================

      combinedEntryModelManager.getOrCreate(
        bot.id,
        bot.symbol,
        bot.direction
      );

      bot.combinedEntryModelId = bot.id;

      console.log(
        `[Bot:${bot.symbol}] Combined Entry Model created | ` +
          `Bot=${bot.id} | Direction=${bot.direction}`
      );

      // ======================================================
      // TRADE CYCLE
      // ======================================================

      const cycle = tradeCycleManager.create(
        bot.id,
        {
          direction: bot.direction,
          position: null,
        }
      );

      bot.cycleId = bot.id;

      console.log(
        `[Bot:${bot.symbol}] Trade cycle created | ` +
          `Cycle=${cycle.botId}`
      );

      // ======================================================
      // LOG
      // ======================================================

      console.log(
        `[Bot] Created ${bot.name} | ` +
          `${bot.symbol} | ` +
          `${bot.direction} | ` +
          `Pyramid=${bot.pyramidPositions} | ` +
          `PyramidMultiplier=${bot.pyramidPositionMultiplier} | ` +
          `Risk=${bot.riskLevel} (${bot.riskMultiplier}x)`
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
      // ======================================================

      if (
        bot.triggerLineEnabled === true &&
        bot.triggerState === "NEUTRAL"
      ) {
        advanced.startTriggerMonitor(bot);
      }

      // ======================================================
      // RESPONSE
      // ======================================================

      return res.status(201).json({
        success: true,
        bot,
      });
    } catch (error) {
      console.error("[Bot] Create error:", error);

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ==========================================================
  // ENTER
  // ==========================================================

  router.post("/:id/enter", async (req, res) => {
    const bot =
      bots.find((item) => item.id === req.params.id);

    try {
      const result = await botEntry.enter({
        bot,
        orders,
        positions,
        advanced,
      });

      if (!result.ok) {
        return res
          .status(result.status)
          .json({
            success: false,
            error: result.error,
          });
      }

      return res.json({
        success: true,
        bot,
        trade: result.result.trade,
        openResult: result.result.openResult,
        triggerState: bot.triggerState,
        triggerLinePrice: bot.triggerLinePrice,
      });
    } catch (error) {
      console.error(
        `[Bot:${bot?.symbol || req.params.id}] ENTER ERROR:`,
        error
      );

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ==========================================================
  // CLOSE
  // ==========================================================

  router.post("/:id/close", async (req, res) => {
    const bot =
      bots.find((item) => item.id === req.params.id);

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: "Bot not found",
      });
    }

    try {
      advanced.cancelProtectionTimer(bot);

      const closeResult =
        await orders.closeTestPosition(bot.symbol);

      if (
        bot.currentTpOrderId &&
        typeof orders.cancelTpOrder === "function"
      ) {
        try {
          await orders.cancelTpOrder(
            bot.currentTpOrderId
          );
        } catch (error) {
          console.error(
            `[Bot:${bot.symbol}] TP cancel failed:`,
            error.message
          );
        }
      }

      console.log(
        `[Bot:${bot.symbol}] CLOSE REQUEST SENT | ` +
          `Lifecycle will finalize after FLAT | ` +
          `TriggerState=${bot.triggerState}`
      );

      return res.json({
        success: true,
        closeResult,
        bot,
        triggerState: bot.triggerState,
      });
    } catch (error) {
      console.error(
        `[Bot:${bot.symbol}] CLOSE ERROR:`,
        error
      );

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ==========================================================
  // PAUSE
  // ==========================================================

  router.post("/:id/pause", (req, res) => {
    const bot =
      bots.find((item) => item.id === req.params.id);

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: "Bot not found",
      });
    }

    bot.status = "PAUSED";

    return res.json({
      success: true,
      bot,
    });
  });

  // ==========================================================
  // RESUME
  // ==========================================================

  router.post("/:id/resume", (req, res) => {
    const bot =
      bots.find((item) => item.id === req.params.id);

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: "Bot not found",
      });
    }

    bot.status = "ACTIVE";

    if (
      bot.triggerLineEnabled === true &&
      bot.triggerState === "NEUTRAL"
    ) {
      advanced.startTriggerMonitor(bot);
    }

    return res.json({
      success: true,
      bot,
    });
  });

  // ==========================================================
  // MASTER ENTRY MODEL START
  // ==========================================================

  router.post(
    "/:id/entry-model/start",
    async (req, res) => {
      const bot =
        bots.find((item) => item.id === req.params.id);

      if (!bot) {
        return res.status(404).json({
          success: false,
          error: "Bot not found",
        });
      }

      try {
        const result =
          await botModels.startCombinedEntryModel(
            bot.id
          );

        console.log(
          `[Bot:${bot.symbol}] MASTER START | ` +
            `Price Model + Combined Entry Model`
        );

        return res
          .status(result.status)
          .json(result.body);
      } catch (error) {
        console.error(
          `[Bot:${bot.symbol}] MASTER START ERROR:`,
          error
        );

        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // ==========================================================
  // MASTER ENTRY MODEL STOP
  // ==========================================================

  router.post(
    "/:id/entry-model/stop",
    async (req, res) => {
      const bot =
        bots.find((item) => item.id === req.params.id);

      if (!bot) {
        return res.status(404).json({
          success: false,
          error: "Bot not found",
        });
      }

      try {
        const result =
          await botModels.stopCombinedEntryModel(
            bot.id
          );

        console.log(
          `[Bot:${bot.symbol}] MASTER STOP | ` +
            `Price Model + Combined Entry Model`
        );

        return res
          .status(result.status)
          .json(result.body);
      } catch (error) {
        console.error(
          `[Bot:${bot.symbol}] MASTER STOP ERROR:`,
          error
        );

        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // ==========================================================
  // DELETE BOT
  // ==========================================================

  router.delete("/:id", (req, res) => {
    const index =
      bots.findIndex((item) => item.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: "Bot not found",
      });
    }

    const bot = bots[index];

    advanced.stopAll(bot);
    tradeLifecycle.stop(bot.id);
    entryModelEngine.stopEngine(bot.id);

    const combinedEntryModel =
      combinedEntryModelManager.get(bot.id);

    if (combinedEntryModel) {
      combinedEntryModel.stop();
    }

    combinedEntryModelManager.remove(bot.id);

    const priceModel =
      priceModelManager.get(bot.id);

    if (priceModel) {
      priceModel.stop();
    }

    priceModelManager.remove(bot.id);

    bots.splice(index, 1);

    console.log(
      `[Bot] Deleted ${bot.name} | ${bot.symbol}`
    );

    return res.json({
      success: true,
      deletedBotId: bot.id,
    });
  });

  // ==========================================================
  // INTERNAL BOT LOOKUP
  // ==========================================================

  router.getBot = (botId) => {
    return bots.find((bot) => bot.id === botId) || null;
  };

  return router;
};
