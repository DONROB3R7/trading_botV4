const express =
  require("express");

const router =
  express.Router();

// ============================================================
// ADVANCED BOT LOGIC
// ============================================================

const BotAdvanced =
  require("./botAdvanced");

// ============================================================
// BOT ENTRY / PYRAMID LOGIC
// ============================================================

const BotEntry =
  require("./botEntry");

// ============================================================
// BOT ENTRY MODEL LOGIC
// ============================================================

const BotEntryModel =
  require("./botEntryModel");

// ============================================================
// BOT MODELS
// ============================================================

const BotModels =
  require("./botModels");

// ============================================================
// TRADE CYCLE
// ============================================================

const tradeCycleManager =
  require("../cycle/tradeCycleManager");

// ============================================================
// TRADE LIFECYCLE
// ============================================================

const tradeLifecycle =
  require("../lifecycle/tradeLifecycle");

// ============================================================
// ENTRY MODEL
// ============================================================

const entryModelEngine =
  require("../entry-models/entryModelEngine");

// ============================================================
// PRICE MODEL
// ============================================================

const PriceModelManager =
  require("../entry-models/priceModelManager");

// ============================================================
// COMBINED ENTRY MODEL
// ============================================================

const CombinedEntryModelManager =
  require("../entry-models/combinedEntryModelManager");

// ============================================================
// BOT STORAGE
// ============================================================

const bots = [];

// ============================================================
// ADVANCED LOGIC
// ============================================================

const advanced =
  new BotAdvanced();

// ============================================================
// BOT ENTRY
// ============================================================

const botEntry =
  new BotEntry();

// ============================================================
// BOT ENTRY MODEL
// ============================================================

const botEntryModel =
  new BotEntryModel();

// ============================================================
// PRICE MODEL MANAGER
// ============================================================

const priceModelManager =
  new PriceModelManager();

// ============================================================
// COMBINED ENTRY MODEL MANAGER
// ============================================================

const combinedEntryModelManager =
  new CombinedEntryModelManager();

// ============================================================
// BOT MODELS
// ============================================================

const botModels =
  new BotModels({

    bots,

    priceModelManager,

    combinedEntryModelManager,

  });

// ============================================================
// MODEL ROUTES
// ============================================================

// ============================================================
// GET PRICE MODEL
// ============================================================

router.get(
  "/:botId/price-model",
  (req, res) => {

    const result =
      botModels.getPriceModel(
        req.params.botId
      );

    return res
      .status(result.status)
      .json(result.body);

  }
);

// ============================================================
// GET COMBINED ENTRY MODEL
// ============================================================

router.get(
  "/:botId/combined-entry-model",
  (req, res) => {

    const result =
      botModels.getCombinedEntryModel(
        req.params.botId
      );

    return res
      .status(result.status)
      .json(result.body);

  }
);

// ============================================================
// START COMBINED ENTRY MODEL
// ============================================================

router.post(
  "/:botId/combined-entry-model/start",
  async (req, res) => {

    const result =
      await botModels.startCombinedEntryModel(
        req.params.botId
      );

    return res
      .status(result.status)
      .json(result.body);

  }
);

// ============================================================
// STOP COMBINED ENTRY MODEL
// ============================================================

router.post(
  "/:botId/combined-entry-model/stop",
  async (req, res) => {

    const result =
      await botModels.stopCombinedEntryModel(
        req.params.botId
      );

    return res
      .status(result.status)
      .json(result.body);

  }
);

// ============================================================
// START PRICE MODEL
// ============================================================

router.post(
  "/:botId/price-model/start",
  async (req, res) => {

    const result =
      await botModels.startPriceModel(
        req.params.botId
      );

    return res
      .status(result.status)
      .json(result.body);

  }
);

// ============================================================
// STOP PRICE MODEL
// ============================================================

router.post(
  "/:botId/price-model/stop",
  (req, res) => {

    const result =
      botModels.stopPriceModel(
        req.params.botId
      );

    return res
      .status(result.status)
      .json(result.body);

  }
);

// ============================================================
// PRICE MODEL BIAS
// ============================================================

router.post(
  "/:botId/price-model/bias",
  (req, res) => {

    const result =
      botModels.setPriceModelBias(
        req.params.botId,
        req.body?.bias
      );

    return res
      .status(result.status)
      .json(result.body);

  }
);

// ============================================================
// PRICE MODEL SCAN
// ============================================================

router.post(
  "/:botId/price-model/scan",
  async (req, res) => {

    const result =
      await botModels.scanPriceModel(
        req.params.botId
      );

    return res
      .status(result.status)
      .json(result.body);

  }
);

// ============================================================
// BOT ROUTER FACTORY
// ============================================================

module.exports =
  function createBotsRouter({
    orders,
    positions,
  }) {

    // ========================================================
    // TRADE LIFECYCLE CONFIG
    // ========================================================

    tradeLifecycle.configure({

      orders,

      positions,

    });

    // ========================================================
    // COMBINED ENTRY EXECUTION CONFIG
    // ========================================================

          botModels.configureEntryExecution({

            botEntry,

            orders,

            positions,

            advanced,

          });

    // ========================================================
    // BOT LOOKUP FOR TRADE LIFECYCLE
    // ========================================================

    tradeLifecycle.configureBotLookup(
      (botId) => {

        return (
          bots.find(
            (bot) =>
              bot.id === botId
          ) || null
        );

      }
    );

    // ========================================================
    // GET ALL BOTS
    // ========================================================

    router.get(
      "/",
      (req, res) => {

        console.log(
          `[Bot] GET /api/bots | Count=${bots.length}`
        );

        return res.json(
          bots
        );

      }
    );

    // ========================================================
    // CREATE BOT
    // ========================================================

    router.post(
      "/",
      async (req, res) => {

        try {

          const body =
            req.body || {};

          // ==================================================
          // BASIC DATA
          // ==================================================

          const cleanName =
            advanced.cleanString(
              body.name,
              `Bot ${bots.length + 1}`
            );

          const cleanSymbol =
            advanced.cleanString(
              body.symbol
            ).toUpperCase();

          if (!cleanSymbol) {

            return res.status(400).json({

              success:
                false,

              error:
                "Symbol is required",

            });

          }

          const botDirection =
            advanced.cleanDirection(
              body.direction
            );

          const cleanEntryModel =
            advanced.cleanString(
              body.entryModel,
              "BUTTON_PRESS"
            );

          const cleanStopLoss =
            advanced.cleanNumber(
              body.stopLoss,
              0
            );

          const cleanTakeProfit =
            advanced.cleanNumber(
              body.takeProfit,
              0
            );

          // ==================================================
          // PYRAMID
          // ==================================================

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

          // ==================================================
          // TRIGGER LINE
          // ==================================================

          const triggerLineEnabled =
            advanced.cleanTriggerLineEnabled(
              body.triggerLineEnabled
            );

          const triggerLinePrice =
            advanced.cleanNumber(
              body.triggerLinePrice,
              0
            );

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

              success:
                false,

              error:
                "Trigger Line is enabled but trigger price is invalid",

            });

          }

          // ==================================================
          // INITIAL TRIGGER STATE
          // ==================================================

          let initialTriggerPrice =
            null;

          let initialTriggerState =
            advanced.cleanTriggerState(
              null,
              triggerLineEnabled
            );

          let triggerArmedAt =
            null;

          let triggerArmedPrice =
            null;

          // ==================================================
          // TRIGGER ENABLED
          // ==================================================

          if (
            triggerLineEnabled
          ) {

            initialTriggerState =
              "NEUTRAL";

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

                success:
                  false,

                error:
                  `Could not get current market price for ${cleanSymbol}: ${error.message}`,

              });

            }

          } else {

            initialTriggerState =
              "ARMED";

            console.log(
              `[Trigger:${cleanSymbol}] ` +
              `Trigger Line disabled | Bot starts ARMED`
            );

          }

          // ==================================================
          // BOT OBJECT
          // ==================================================

          const bot =
            botModels.createBot({

              id:
                `bot_${Date.now()}`,

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

              triggerLineEnabled,

              triggerLinePrice:
                triggerLineEnabled
                  ? triggerLinePrice
                  : null,

              triggerState:
                initialTriggerState,

              triggerLastPrice:
                initialTriggerPrice,

              triggerArmedAt,

              triggerArmedPrice,

              tradeLifecycle,

              entryModelEngine,

            });

          // ==================================================
          // STORE BOT
          // ==================================================

          bots.push(
            bot
          );

          // ==================================================
          // PRICE MODEL
          // ==================================================

          const priceModel =
            priceModelManager.getOrCreate(
              bot.id,
              bot.symbol,
              bot.direction
            );

          console.log(
            `[Bot:${bot.symbol}] ` +
            `Price Model created | ` +
            `Bot=${bot.id} | ` +
            `Direction=${bot.direction}`
          );

          // ==================================================
          // COMBINED ENTRY MODEL
          // ==================================================

          const combinedEntryModel =
            combinedEntryModelManager.getOrCreate(
              bot.id,
              bot.symbol,
              bot.direction
            );

          bot.combinedEntryModelId =
            bot.id;

          console.log(
            `[Bot:${bot.symbol}] ` +
            `Combined Entry Model created | ` +
            `Bot=${bot.id} | ` +
            `Direction=${bot.direction}`
          );

          // ==================================================
          // TRADE CYCLE
          // ==================================================

          const cycle =
            tradeCycleManager.create(
              bot.id,
              {

                direction:
                  bot.direction,

                position:
                  null,

              }
            );

          bot.cycleId =
            bot.id;

          console.log(
            `[Bot:${bot.symbol}] ` +
            `Trade cycle created | ` +
            `Cycle=${cycle.botId}`
          );

          // ==================================================
          // LOG
          // ==================================================

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

          // ==================================================
          // START TRIGGER MONITOR
          // ==================================================

          if (
            bot.triggerLineEnabled ===
              true &&
            bot.triggerState ===
              "NEUTRAL"
          ) {

            advanced.startTriggerMonitor(
              bot
            );

          }

          // ==================================================
          // RESPONSE
          // ==================================================

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

      }
    );

    // ========================================================
    // ENTER
    // ========================================================

    router.post(
      "/:id/enter",
      async (req, res) => {

        const bot =
          bots.find(
            (item) =>
              item.id ===
              req.params.id
          );

        try {

          const result =
            await botEntry.enter({

              bot,

              orders,

              positions,

              advanced,

            });

          if (!result.ok) {

            return res
              .status(result.status)
              .json({

                success:
                  false,

                error:
                  result.error,

              });

          }

          return res.json({

            success:
              true,

            bot,

            trade:
              result.result.trade,

            openResult:
              result.result.openResult,

            triggerState:
              bot.triggerState,

            triggerLinePrice:
              bot.triggerLinePrice,

          });

        } catch (error) {

          console.error(
            `[Bot:${bot?.symbol || req.params.id}] ` +
            `ENTER ERROR:`,
            error
          );

          return res.status(500).json({

            success:
              false,

            error:
              error.message,

          });

        }

      }
    );

    // ========================================================
    // CLOSE
    // ========================================================

    router.post(
      "/:id/close",
      async (req, res) => {

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

        try {

          // =================================================
          // CANCEL TP/SL PROTECTION TIMER
          // =================================================

          advanced.cancelProtectionTimer(
            bot
          );

          // =================================================
          // CLOSE POSITION
          // =================================================

          const closeResult =
            await orders.closeTestPosition(
              bot.symbol
            );

          // =================================================
          // CANCEL TRACKED TP
          // =================================================

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

          // =================================================
          // LIFECYCLE FINALIZES AFTER FLAT
          // =================================================

          console.log(
            `[Bot:${bot.symbol}] ` +
            `CLOSE REQUEST SENT | ` +
            `Lifecycle will finalize after FLAT | ` +
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
            `[Bot:${bot.symbol}] ` +
            `CLOSE ERROR:`,
            error
          );

          return res.status(500).json({

            success:
              false,

            error:
              error.message,

          });

        }

      }
    );

    // ========================================================
    // PAUSE
    // ========================================================

    router.post(
      "/:id/pause",
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

        return res.json({

          success:
            true,

          bot,

        });

      }
    );

    // ========================================================
    // RESUME
    // ========================================================

    router.post(
      "/:id/resume",
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

        // ==================================================
        // RESTART TRIGGER MONITOR
        // ==================================================

        if (
          bot.triggerLineEnabled ===
            true &&
          bot.triggerState ===
            "NEUTRAL"
        ) {

          advanced.startTriggerMonitor(
            bot
          );

        }

        return res.json({

          success:
            true,

          bot,

        });

      }
    );

    // ========================================================
    // MASTER ENTRY MODEL START
    // ========================================================
    //
    // BOT MANAGEMENT START
    //
    // This is now the ONE master START command.
    //
    // It starts:
    //
    //   1. Price Model
    //   2. Combined Entry Model
    //
    // React keeps using:
    //
    //   POST /:id/entry-model/start
    //
    // but the server now routes that command
    // into the new master engine.
    //

    router.post(
      "/:id/entry-model/start",
      async (req, res) => {

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

        try {

          const result =
            await botModels.startCombinedEntryModel(
              bot.id
            );

          console.log(
            `[Bot:${bot.symbol}] ` +
            `MASTER START | ` +
            `Price Model + Combined Entry Model`
          );

          return res
            .status(result.status)
            .json(result.body);

        } catch (error) {

          console.error(
            `[Bot:${bot.symbol}] ` +
            `MASTER START ERROR:`,
            error
          );

          return res.status(500).json({

            success:
              false,

            error:
              error.message,

          });

        }

      }
    );

    // ========================================================
    // MASTER ENTRY MODEL STOP
    // ========================================================
    //
    // BOT MANAGEMENT STOP
    //
    // This is now the ONE master STOP command.
    //
    // It stops:
    //
    //   1. Combined Entry Model
    //   2. Price Model
    //

    router.post(
      "/:id/entry-model/stop",
      async (req, res) => {

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

        try {

          const result =
            await botModels.stopCombinedEntryModel(
              bot.id
            );

          console.log(
            `[Bot:${bot.symbol}] ` +
            `MASTER STOP | ` +
            `Price Model + Combined Entry Model`
          );

          return res
            .status(result.status)
            .json(result.body);

        } catch (error) {

          console.error(
            `[Bot:${bot.symbol}] ` +
            `MASTER STOP ERROR:`,
            error
          );

          return res.status(500).json({

            success:
              false,

            error:
              error.message,

          });

        }

      }
    );

    // ========================================================
    // DELETE BOT
    // ========================================================

    router.delete(
      "/:id",
      (req, res) => {

        const index =
          bots.findIndex(
            (item) =>
              item.id ===
              req.params.id
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

        // ==================================================
        // STOP ALL ADVANCED TIMERS
        // ==================================================

        advanced.stopAll(
          bot
        );

        // ==================================================
        // STOP TRADE LIFECYCLE
        // ==================================================

        tradeLifecycle.stop(
          bot.id
        );

        // ==================================================
        // STOP OLD ENTRY MODEL ENGINE
        // ==================================================

        entryModelEngine.stopEngine(
          bot.id
        );

        // ==================================================
        // STOP COMBINED ENTRY MODEL
        // ==================================================

        const combinedEntryModel =
          combinedEntryModelManager.get(
            bot.id
          );

        if (
          combinedEntryModel
        ) {

          combinedEntryModel.stop();

        }

        combinedEntryModelManager.remove(
          bot.id
        );

        // ==================================================
        // STOP PRICE MODEL
        // ==================================================

        const priceModel =
          priceModelManager.get(
            bot.id
          );

        if (
          priceModel
        ) {

          priceModel.stop();

        }

        priceModelManager.remove(
          bot.id
        );

        // ==================================================
        // DELETE BOT
        // ==================================================

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

      }
    );

    // ========================================================
    // INTERNAL BOT LOOKUP
    // ========================================================

    router.getBot =
      (
        botId
      ) => {

        return (
          bots.find(
            (bot) =>
              bot.id === botId
          ) || null
        );

      };

    // ========================================================
    // RETURN ROUTER
    // ========================================================

    return router;

  };
