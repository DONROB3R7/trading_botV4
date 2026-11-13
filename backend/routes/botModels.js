
const tradeLifecycle =
  require("../lifecycle/tradeLifecycle");

const entryModelEngine =
  require("../entry-models/entryModelEngine");

const CombinedOrderbookScanner =
  require("../entry-models/combinedOrderbookScanner");

class BotModels {
  constructor({
    bots,
    priceModelManager,
    combinedEntryModelManager,
  }) {
    this.bots = bots;
    this.priceModelManager = priceModelManager;
    this.combinedEntryModelManager =
      combinedEntryModelManager;

    // ========================================================
    // COMBINED ORDERBOOK SCANNER
    // ========================================================

    this.combinedOrderbookScanner =
      new CombinedOrderbookScanner({
        combinedEntryModelManager:
          this.combinedEntryModelManager,
      });

    // ========================================================
    // ORDERBOOK EXHAUSTED → PRICE MODEL BRIDGE
    // ========================================================

    this.combinedOrderbookScanner
      .setReturnToPriceModelHandler(
        async (botId) => {
          console.log(
            `[BotModels] ORDERBOOK EXHAUSTED → ` +
              `START NEW PRICE MODEL | Bot=${botId}`
          );

          const result =
            await this.startPriceModel(botId);

          console.log(
            `[BotModels] NEW PRICE MODEL CYCLE STARTED | ` +
              `Bot=${botId}`
          );

          return result;
        }
      );

    // ========================================================
    // PRICE MODEL → COMBINED ENTRY BRIDGE
    // ========================================================

    if (
      this.priceModelManager &&
      this.priceModelManager.setCycleCompleteHandler
    ) {
      this.priceModelManager.setCycleCompleteHandler(
        (botId, cycle) =>
          this.handlePriceCycleCompleted(botId, cycle)
      );
    }

    console.log("[BotModels] Initialized");
  }

  // ==========================================================
  // CONFIGURE COMBINED ENTRY EXECUTION
  // ==========================================================

  configureEntryExecution({
    botEntry,
    orders,
    positions,
    advanced,
  }) {
    this.botEntry = botEntry;
    this.orders = orders;
    this.positions = positions;
    this.advanced = advanced;

    // ========================================================
    // CONNECT SCANNER → BOT ENTRY
    // ========================================================

    this.combinedOrderbookScanner.setEntryHandler(
      async (payload) => {
        const botId =
          typeof payload === "string"
            ? payload
            : payload?.botId;

        const bot =
          payload?.bot ||
          this.getBot(botId);

        if (!bot) {
          console.error(
            `[BotModels] ENTRY EXECUTION FAILED | ` +
              `Bot not found | Bot=${botId || "UNKNOWN"}`
          );

          return {
            ok: false,
            error: "Bot not found",
          };
        }

        console.log(
          `[BotModels] COMBINED ENTRY → BOT ENTRY | ` +
            `Bot=${bot.id} | ` +
            `Symbol=${bot.symbol} | ` +
            `Direction=${bot.direction}`
        );

        if (
          !this.botEntry ||
          typeof this.botEntry.enter !== "function"
        ) {
          console.error(
            "[BotModels] ENTRY EXECUTION FAILED | " +
              "BotEntry service not configured"
          );

          return {
            ok: false,
            error: "BotEntry service not configured",
          };
        }

        // ======================================================
        // GET COMBINED CONTROLLER
        // ======================================================

        const combined =
          this.combinedEntryModelManager.get(bot.id);

        if (!combined) {
          console.error(
            `[BotModels] ENTRY EXECUTION FAILED | ` +
              `Combined model not found | Bot=${bot.id}`
          );

          return {
            ok: false,
            error: "Combined Entry Model not found",
          };
        }

        // ======================================================
        // EXECUTE ENTRY
        // ======================================================

        const result =
          await this.botEntry.enter({
            bot,
            orders: this.orders,
            positions: this.positions,
            advanced: this.advanced,
          });

        // ======================================================
        // PYRAMID ENTRY SKIPPED
        // ======================================================

        if (result && result.skipped === true) {
          const skipReason =
            result.result?.reason ||
            result.reason ||
            "UNKNOWN";

          console.log(
            `[BotModels] ENTRY SKIPPED | ` +
              `Bot=${bot.id} | ` +
              `Reason=${skipReason} | ` +
              `Pyramid=${bot.currentPositionCount}/${bot.maxPositions} | ` +
              `Starting NEW Price Model cycle`
          );

          const priceModel =
            this.priceModelManager.get(bot.id);

          if (!priceModel) {
            console.error(
              `[BotModels] SKIP CONTINUE FAILED | ` +
                `Price Model not found | Bot=${bot.id}`
            );
          } else {
            await priceModel.start();

            console.log(
              `[BotModels] NEW PRICE CYCLE STARTED AFTER SKIP | ` +
                `Bot=${bot.id} | ` +
                `Pyramid=${bot.currentPositionCount}/${bot.maxPositions}`
            );
          }

          return result;
        }

        // ======================================================
        // ENTRY FAILED
        // ======================================================

        if (!result || result.ok !== true) {
          console.log(
            `[BotModels] ENTRY FAILED | Bot=${bot.id}`
          );

          if (
            typeof combined.handleEntryResult === "function"
          ) {
            combined.handleEntryResult({
              ok: false,
              success: false,
              botId: bot.id,
              result,
            });
          }

          return result;
        }

        // ======================================================
        // ENTRY SUCCESS
        // ======================================================

        console.log(
          `[BotModels] ENTRY SUCCESS | ` +
            `Bot=${bot.id} | ` +
            `Pyramid=${bot.currentPositionCount}/${bot.maxPositions}`
        );

        // ======================================================
        // TELL COMBINED CONTROLLER
        // ======================================================

        if (
          typeof combined.handleEntryResult === "function"
        ) {
          const combinedResult =
            combined.handleEntryResult({
              ok: true,
              success: true,
              botId: bot.id,
              result,
            });

          console.log(
            `[BotModels] COMBINED ENTRY RESULT | ` +
              `Bot=${bot.id} | ` +
              `Pyramid=${combinedResult?.pyramidCount ?? "UNKNOWN"}/${bot.maxPositions} | ` +
              `State=${combinedResult?.state || combined.getState()?.state || "UNKNOWN"}`
          );
        } else {
          console.error(
            `[BotModels] COMBINED ENTRY RESULT FAILED | ` +
              `handleEntryResult() not available | Bot=${bot.id}`
          );
        }

        // ======================================================
        // PYRAMID NOT FULL
        // ======================================================

        if (
          bot.currentPositionCount <
          bot.maxPositions
        ) {
          console.log(
            `[BotModels] PYRAMID CONTINUE | ` +
              `Bot=${bot.id} | ` +
              `Pyramid=${bot.currentPositionCount}/${bot.maxPositions} | ` +
              `Starting NEW Price Model cycle`
          );

          const priceModel =
            this.priceModelManager.get(bot.id);

          if (!priceModel) {
            console.error(
              `[BotModels] PYRAMID CONTINUE FAILED | ` +
                `Price Model not found | Bot=${bot.id}`
            );
          } else {
            await priceModel.start();

            console.log(
              `[BotModels] NEW PRICE MODEL CYCLE STARTED | ` +
                `Bot=${bot.id} | ` +
                `Pyramid=${bot.currentPositionCount}/${bot.maxPositions}`
            );
          }
        } else {
          console.log(
            `[BotModels] PYRAMID FULL | ` +
              `Bot=${bot.id} | ` +
              `${bot.currentPositionCount}/${bot.maxPositions} | ` +
              `Waiting for position close`
          );
        }

        return result;
      }
    );

    console.log("[BotModels] Entry execution configured");
  }

  // ==========================================================
  // BOT LOOKUP
  // ==========================================================

  getBot(botId) {
    return (
      this.bots.find((bot) => bot.id === botId) || null
    );
  }

  // ==========================================================
  // CLEAN MODEL FOR API
  // ==========================================================

  cleanModel(model) {
    if (!model) {
      return null;
    }

    const seen = new WeakSet();

    const sensitiveKeys = new Set([
      "apiKey",
      "apiSecret",
      "secret",
      "passphrase",
      "password",
      "privateKey",
      "accessToken",
      "refreshToken",
      "authorization",
      "token",
    ]);

    const clean = (value, path = []) => {
      if (
        value === null ||
        value === undefined
      ) {
        return value;
      }

      if (typeof value !== "object") {
        return value;
      }

      if (
        value.constructor &&
        value.constructor.name === "Timeout"
      ) {
        return undefined;
      }

      if (seen.has(value)) {
        return undefined;
      }

      seen.add(value);

      if (Array.isArray(value)) {
        const result = [];

        for (let i = 0; i < value.length; i++) {
          const cleaned = clean(value[i], [...path, i]);

          if (cleaned !== undefined) {
            result.push(cleaned);
          }
        }

        return result;
      }

      const result = {};

      for (const [key, child] of Object.entries(value)) {
        if (sensitiveKeys.has(key)) {
          continue;
        }

        if (
          path.length > 0 &&
          path[path.length - 1] === "marketData" &&
          key === "client"
        ) {
          continue;
        }

        const cleaned = clean(child, [...path, key]);

        if (cleaned !== undefined) {
          result[key] = cleaned;
        }
      }

      return result;
    };

    try {
      return clean(model);
    } catch (error) {
      console.error(
        "[BotModels] Could not serialize model:",
        error.message
      );

      return null;
    }
  }

  // ==========================================================
  // CREATE BOT
  // ==========================================================

  createBot({
    id,
    name,
    symbol,
    direction,
    entryModel,
    stopLoss,
    takeProfit,
    pyramidPositions,
    pyramidDistance,
    pyramidPositionMultiplier = 1,

    // RISK LEVEL
    riskLevel = "BASE",

    // MAX CONSECUTIVE LOSSES
    consecutiveLossLimit = 1,

    triggerLineEnabled,
    triggerLinePrice,
    triggerState,
    triggerLastPrice,
    triggerArmedAt,
    triggerArmedPrice,

    tradeLifecycle: lifecycle = tradeLifecycle,
    entryModelEngine: engine = entryModelEngine,
  }) {
    // ========================================================
    // VALIDATE PYRAMID POSITION MULTIPLIER
    // ========================================================

    const allowedMultipliers = [
      1,
      1.5,
      2,
      2.5,
      3,
    ];

    const requestedMultiplier =
      Number(pyramidPositionMultiplier);

    const cleanMultiplier =
      allowedMultipliers.includes(requestedMultiplier)
        ? requestedMultiplier
        : 1;

    // ========================================================
    // VALIDATE RISK LEVEL
    // BASE = 1x
    // GOOD = 2x
    // EXTREME = 3x
    // ========================================================

    const allowedRiskLevels = {
      BASE: 1,
      GOOD: 2,
      EXTREME: 3,
    };

    const requestedRiskLevel =
      String(riskLevel || "BASE")
        .trim()
        .toUpperCase();

    const cleanRiskLevel =
      Object.prototype.hasOwnProperty.call(
        allowedRiskLevels,
        requestedRiskLevel
      )
        ? requestedRiskLevel
        : "BASE";

    const cleanRiskMultiplier =
      allowedRiskLevels[cleanRiskLevel];

    // ========================================================
    // VALIDATE CONSECUTIVE LOSS LIMIT
    // DEFAULT = 1 LOSS
    // ========================================================

    const requestedLossLimit =
      Number(consecutiveLossLimit);

    const cleanLossLimit =
      Number.isFinite(requestedLossLimit) &&
      requestedLossLimit >= 1
        ? Math.floor(requestedLossLimit)
        : 1;

    // ========================================================
    // CREATE BOT
    // ========================================================

    const bot = {
      id,
      name,
      symbol,
      direction,
      entryModel,
      stopLoss,
      takeProfit,
      pyramidPositions,

      // PYRAMID POSITION MULTIPLIER

      pyramidPositionMultiplier: cleanMultiplier,

      // RISK LEVEL

      riskLevel: cleanRiskLevel,
      riskMultiplier: cleanRiskMultiplier,

      // CONSECUTIVE LOSS PROTECTION

      consecutiveLossLimit: cleanLossLimit,
      consecutiveLosses: 0,

      // PYRAMID DISTANCE

      pyramidDistance,

      maxPositions: pyramidPositions,
      currentPositionCount: 0,
      firstEntryPrice: null,
      averageEntryPrice: null,
      originalStopLoss: null,
      currentTakeProfit: null,
      currentTpOrderId: null,
      trades: [],
      status: "ACTIVE",
      createdAt: new Date().toISOString(),

      triggerLineEnabled,
      triggerLinePrice,
      triggerState,
      triggerLastPrice,
      triggerArmedAt,
      triggerArmedPrice,
    };

    // ========================================================
    // TRADE PROFIT
    // ========================================================

    bot.onTradeProfit = async (finalPnl) => {
      // A WIN RESETS THE CONSECUTIVE LOSS COUNTER
      bot.consecutiveLosses = 0;

      console.log(
        `[Bot:${bot.symbol}] TRADE CYCLE PROFIT | ` +
          `P/L=${finalPnl} | RESET NEW LIFE`
      );

      lifecycle.stop(bot.id);
      this.combinedOrderbookScanner.stop(bot.id);

      const priceModel =
        this.priceModelManager.get(bot.id);

      if (priceModel) {
        priceModel.stop();
      }

      const combined =
        this.combinedEntryModelManager.get(bot.id);

      if (combined) {
        if (typeof combined.resetCampaign === "function") {
          combined.resetCampaign();

          console.log(
            `[Bot:${bot.symbol}] COMBINED RESET | ` +
              `Pyramid=${combined.pyramidCount}/${bot.maxPositions} | ` +
              `State=${combined.state}`
          );
        } else {
          console.error(
            `[Bot:${bot.symbol}] COMBINED RESET FAILED | ` +
              `resetCampaign() not available`
          );
        }
      }

      this.resetTradeState(bot);
      bot.status = "ACTIVE";

      if (!priceModel) {
        console.error(
          `[Bot:${bot.symbol}] PROFIT RESET FAILED | ` +
            `Price Model not found`
        );
      } else {
        await priceModel.start();

        console.log(
          `[Bot:${bot.symbol}] NEW PRICE MODEL CYCLE STARTED | ` +
            `Pyramid=${bot.currentPositionCount}/${bot.maxPositions}`
        );
      }

      console.log(
        `[Bot:${bot.symbol}] NEW TRADE CYCLE READY`
      );
    };

    // ========================================================
    // TRADE LOSS
    // ========================================================

    bot.onTradeLoss = async (finalPnl) => {
      bot.consecutiveLosses += 1;

      console.log(
        `[Bot:${bot.symbol}] TRADE CYCLE LOSS | ` +
          `P/L=${finalPnl} | ` +
          `Consecutive=${bot.consecutiveLosses}/${bot.consecutiveLossLimit}`
      );

      lifecycle.stop(bot.id);
      this.combinedOrderbookScanner.stop(bot.id);

      const priceModel =
        this.priceModelManager.get(bot.id);

      if (priceModel) {
        priceModel.stop();
      }

      const combined =
        this.combinedEntryModelManager.get(bot.id);

      // ======================================================
      // LOSS LIMIT REACHED → KILL BOT
      // ======================================================

      if (
        bot.consecutiveLosses >=
        bot.consecutiveLossLimit
      ) {
        if (combined) {
          combined.stop();
        }

        bot.status = "KILLED";

        console.log(
          `[Bot:${bot.symbol}] BOT KILLED | ` +
            `Loss limit reached: ` +
            `${bot.consecutiveLosses}/${bot.consecutiveLossLimit}`
        );

        return;
      }

      // ======================================================
      // LOSS LIMIT NOT REACHED → RESET AND CONTINUE
      // ======================================================

      console.log(
        `[Bot:${bot.symbol}] LOSS LIMIT NOT REACHED | ` +
          `Restarting trade cycle`
      );

      if (
        combined &&
        typeof combined.resetCampaign === "function"
      ) {
        combined.resetCampaign();
      }

      this.resetTradeState(bot);
      bot.status = "ACTIVE";

      if (!priceModel) {
        console.error(
          `[Bot:${bot.symbol}] LOSS RESET FAILED | ` +
            `Price Model not found`
        );

        return;
      }

      await priceModel.start();

      console.log(
        `[Bot:${bot.symbol}] NEW PRICE MODEL CYCLE STARTED | ` +
          `Losses=${bot.consecutiveLosses}/${bot.consecutiveLossLimit}`
      );
    };

    // ========================================================
    // TRADE FLAT
    // ========================================================

    bot.onTradeFlat = async (finalPnl) => {
      console.log(
        `[Bot:${bot.symbol}] TRADE CYCLE ZERO | ` +
          `P/L=${finalPnl} | RESET`
      );

      lifecycle.stop(bot.id);
      this.combinedOrderbookScanner.stop(bot.id);

      const priceModel =
        this.priceModelManager.get(bot.id);

      if (priceModel) {
        priceModel.stop();
      }

      const combined =
        this.combinedEntryModelManager.get(bot.id);

      if (combined) {
        if (typeof combined.resetCampaign === "function") {
          combined.resetCampaign();
        }
      }

      this.resetTradeState(bot);
      bot.status = "ACTIVE";
    };

    return bot;
  }

  // ==========================================================
  // RESET TRADE STATE
  // ==========================================================

  resetTradeState(bot) {
    bot.currentPositionCount = 0;
    bot.firstEntryPrice = null;
    bot.averageEntryPrice = null;
    bot.originalStopLoss = null;
    bot.currentTakeProfit = null;
    bot.currentTpOrderId = null;
    bot.trades = [];
  }

  // ==========================================================
  // PRICE CYCLE → COMBINED ENTRY BRIDGE
  // ==========================================================

  handlePriceCycleCompleted(botId, cycle) {
    if (!cycle) {
      console.log(
        `[BotModels] PRICE CYCLE BRIDGE | No cycle | Bot=${botId}`
      );

      return null;
    }

    const decision =
      String(cycle.decision || "")
        .trim()
        .toUpperCase();

    console.log(
      `[BotModels] PRICE CYCLE COMPLETE | ` +
        `Bot=${botId} | ` +
        `Cycle=${cycle.cycleId} | ` +
        `Decision=${decision}`
    );

    if (
      decision !== "LONG" &&
      decision !== "SHORT"
    ) {
      console.log(
        `[BotModels] PRICE → COMBINED IGNORED | ` +
          `Decision=${decision}`
      );

      return null;
    }

    const combined =
      this.combinedEntryModelManager.get(botId);

    if (!combined) {
      console.error(
        `[BotModels] PRICE → COMBINED FAILED | ` +
          `Combined model not found | Bot=${botId}`
      );

      return null;
    }

    const result =
      combined.receivePriceSignal(decision);

    console.log(
      `[BotModels] PRICE → COMBINED | ` +
        `Bot=${botId} | ` +
        `Decision=${decision} | ` +
        `State=${result?.state || "UNKNOWN"}`
    );

    if (
      result &&
      result.state === "ORDERBOOK_HUNT"
    ) {
      this.combinedOrderbookScanner.start(botId);

      console.log(
        `[BotModels] COMBINED → ORDERBOOK SCANNER | ` +
          `Bot=${botId} | Started`
      );
    }

    return result;
  }

  // ==========================================================
  // GET PRICE MODEL
  // ==========================================================

  getPriceModel(botId) {
    const bot = this.getBot(botId);

    if (!bot) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Bot not found",
        },
      };
    }

    const model =
      this.priceModelManager.get(botId);

    return {
      status: 200,
      body: {
        success: true,
        model: this.cleanModel(model),
      },
    };
  }

  // ==========================================================
  // GET COMBINED ENTRY MODEL
  // ==========================================================

  getCombinedEntryModel(botId) {
    const bot = this.getBot(botId);

    if (!bot) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Bot not found",
        },
      };
    }

    const model =
      this.combinedEntryModelManager.get(botId);

    return {
      status: 200,
      body: {
        success: true,
        model: this.cleanModel(model),
      },
    };
  }

  // ==========================================================
  // START COMBINED ENTRY MODEL
  // ==========================================================

  async startCombinedEntryModel(botId) {
    const bot = this.getBot(botId);

    if (!bot) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Bot not found",
        },
      };
    }

    const combined =
      this.combinedEntryModelManager.get(botId);

    if (!combined) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Combined Entry Model not found",
        },
      };
    }

    const priceModel =
      this.priceModelManager.get(botId);

    if (!priceModel) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Price Model not found",
        },
      };
    }

    combined.start();
    await priceModel.start();

    console.log(
      `[BotModels] COMBINED START | ` +
        `Bot=${botId} | ` +
        `Price Model=${priceModel.running ? "RUNNING" : "STOPPED"} | ` +
        `Combined=${combined.running ? "RUNNING" : "STOPPED"}`
    );

    const state = combined.getState();

    return {
      status: 200,
      body: {
        success: true,
        model: this.cleanModel(state),
      },
    };
  }

  // ==========================================================
  // STOP COMBINED ENTRY MODEL
  // ==========================================================

  async stopCombinedEntryModel(botId) {
    const bot = this.getBot(botId);

    if (!bot) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Bot not found",
        },
      };
    }

    const combined =
      this.combinedEntryModelManager.get(botId);

    if (!combined) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Combined Entry Model not found",
        },
      };
    }

    const priceModel =
      this.priceModelManager.get(botId);

    this.combinedOrderbookScanner.stop(botId);
    combined.stop();

    if (priceModel) {
      priceModel.stop();
    }

    console.log(
      `[BotModels] COMBINED STOP | ` +
        `Bot=${botId} | ` +
        `Price Model=${priceModel?.running ? "RUNNING" : "STOPPED"} | ` +
        `Combined=${combined.running ? "RUNNING" : "STOPPED"}`
    );

    const state = combined.getState();

    return {
      status: 200,
      body: {
        success: true,
        model: this.cleanModel(state),
      },
    };
  }

  // ==========================================================
  // START PRICE MODEL
  // ==========================================================

  async startPriceModel(botId) {
    const bot = this.getBot(botId);

    if (!bot) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Bot not found",
        },
      };
    }

    const model =
      this.priceModelManager.get(botId);

    if (!model) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Price Model not found",
        },
      };
    }

    await model.start();

    return {
      status: 200,
      body: {
        success: true,
        model: this.cleanModel(model),
      },
    };
  }

  // ==========================================================
  // STOP PRICE MODEL
  // ==========================================================

  stopPriceModel(botId) {
    const bot = this.getBot(botId);

    if (!bot) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Bot not found",
        },
      };
    }

    const model =
      this.priceModelManager.get(botId);

    if (!model) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Price Model not found",
        },
      };
    }

    model.stop();

    return {
      status: 200,
      body: {
        success: true,
        model: this.cleanModel(model),
      },
    };
  }

  // ==========================================================
  // SET PRICE MODEL BIAS
  // ==========================================================

  setPriceModelBias(botId, bias) {
    const bot = this.getBot(botId);

    if (!bot) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Bot not found",
        },
      };
    }

    const model =
      this.priceModelManager.get(botId);

    if (!model) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Price Model not found",
        },
      };
    }

    const result = model.setBias(bias);

    return {
      status: 200,
      body: {
        success: true,
        result,
      },
    };
  }

  // ==========================================================
  // SCAN PRICE MODEL
  // ==========================================================

  async scanPriceModel(botId) {
    const bot = this.getBot(botId);

    if (!bot) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Bot not found",
        },
      };
    }

    const model =
      this.priceModelManager.get(botId);

    if (!model) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Price Model not found",
        },
      };
    }

    const result = await model.scan();

    return {
      status: 200,
      body: {
        success: true,
        result,
      },
    };
  }
}

module.exports = BotModels;
