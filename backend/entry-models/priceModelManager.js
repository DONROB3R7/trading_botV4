// ============================================================
// PRICE MODEL MANAGER
//
// One independent Price Model per bot.
//
// DISPLAY / LOGIC ONLY
//
// NOT CONNECTED TO:
// - Trading
// - Orders
// - Orderbook
// - Master Bot Bridge
// - Cooldown
// - Entry Model
// ============================================================

const PriceModelEngine =
  require("./priceModelEngine");

class PriceModelManager {
  constructor({
    onCycleComplete = null,
  } = {}) {
    this.models = new Map();

    this.onCycleComplete =
      typeof onCycleComplete === "function"
        ? onCycleComplete
        : null;
  }

  // ==========================================================
  // SET CYCLE COMPLETE HANDLER
  // ==========================================================

  setCycleCompleteHandler(handler) {
    this.onCycleComplete =
      typeof handler === "function"
        ? handler
        : null;

    console.log(
      `[Price Model] Cycle bridge ${
        this.onCycleComplete
          ? "CONNECTED"
          : "DISCONNECTED"
      }`
    );
  }

  // ==========================================================
  // CREATE / GET
  // ==========================================================

  getOrCreate(
    botId,
    symbol = "",
    direction = "NEUTRAL"
  ) {
    const id = String(botId);

    if (!this.models.has(id)) {
      const engine =
        new PriceModelEngine({
          botId: id,
          symbol: symbol,

          // --------------------------------------------------
          // IMPORTANT:
          //
          // PriceModelEngine now sends:
          //
          //   (botId, completedCycle)
          //
          // So this wrapper MUST receive both arguments.
          // --------------------------------------------------

          onCycleComplete: (
            callbackBotId,
            completedCycle
          ) => {
            if (!this.onCycleComplete) {
              console.log(
                `[Price Model] CYCLE BRIDGE | ` +
                `No handler | ` +
                `Bot=${callbackBotId}`
              );

              return null;
            }

            console.log(
              `[Price Model] MANAGER BRIDGE | ` +
              `Bot=${callbackBotId} | ` +
              `Cycle=${completedCycle?.cycleId} | ` +
              `Decision=${completedCycle?.decision}`
            );

            try {
              return this.onCycleComplete(
                callbackBotId,
                completedCycle
              );
            } catch (error) {
              console.error(
                `[Price Model] CYCLE BRIDGE ERROR | ` +
                `Bot=${callbackBotId} | ` +
                `${error.message}`
              );

              return null;
            }
          },
        });

      // ------------------------------------------------------
      // BOT DIRECTION -> PRICE MODEL BIAS
      // ------------------------------------------------------

      engine.setBias(direction);

      this.models.set(
        id,
        engine
      );

      console.log(
        `[Price Model] Created ${id} | ` +
        `${symbol} | ` +
        `Bias=${engine.bias}`
      );
    }

    return this.models.get(id);
  }

  // ==========================================================
  // GET
  // ==========================================================

  get(botId) {
    return (
      this.models.get(
        String(botId)
      ) || null
    );
  }

  // ==========================================================
  // HAS
  // ==========================================================

  has(botId) {
    return this.models.has(
      String(botId)
    );
  }

  // ==========================================================
  // STATE
  // ==========================================================

  getState(botId) {
    const engine =
      this.get(botId);

    if (!engine) {
      return null;
    }

    return engine.getState();
  }

  getAllStates() {
    const result = {};

    for (
      const [botId, engine]
      of this.models
    ) {
      result[botId] =
        engine.getState();
    }

    return result;
  }

  // ==========================================================
  // REMOVE
  // ==========================================================

  remove(botId) {
    const id = String(botId);

    const removed =
      this.models.delete(id);

    if (removed) {
      console.log(
        `[Price Model] Removed ${id}`
      );
    }

    return removed;
  }

  // ==========================================================
  // RESET
  // ==========================================================

  reset(botId) {
    const engine =
      this.get(botId);

    if (!engine) {
      return null;
    }

    return engine.reset();
  }

  resetAll() {
    for (
      const engine
      of this.models.values()
    ) {
      engine.reset();
    }

    return this.getAllStates();
  }

  // ==========================================================
  // COUNT
  // ==========================================================

  count() {
    return this.models.size;
  }
}

module.exports =
  PriceModelManager;