const CombinedEntryModelController =
  require("./CombinedEntryModelController");

class CombinedEntryModelManager {
  constructor() {
    this.models = new Map();
  }

  // ==========================================================
  // GET OR CREATE
  // ==========================================================

  getOrCreate(
    botId,
    symbol = "",
    direction = "NEUTRAL"
  ) {
    const id = String(botId);

    if (!this.models.has(id)) {
      const controller =
      new CombinedEntryModelController(
        id,
        symbol
      );

      this.models.set(
        id,
        controller
      );

      console.log(
        `[Combined] Created ${id} | ` +
        `${symbol} | ` +
        `Direction=${direction}`
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
    const controller =
      this.get(botId);

    if (!controller) {
      return null;
    }

    return controller.getState();
  }

  // ==========================================================
  // ALL STATES
  // ==========================================================

  getAllStates() {
    const result = {};

    for (
      const [botId, controller]
      of this.models
    ) {
      result[botId] =
        controller.getState();
    }

    return result;
  }

  // ==========================================================
  // REMOVE
  // ==========================================================

  remove(botId) {
    const id = String(botId);

    const controller =
      this.get(id);

    if (controller) {
      controller.stop();
    }

    const removed =
      this.models.delete(id);

    if (removed) {
      console.log(
        `[Combined] Removed ${id}`
      );
    }

    return removed;
  }

  // ==========================================================
  // RESET
  // ==========================================================

  reset(botId) {
    const controller =
      this.get(botId);

    if (!controller) {
      return null;
    }

    return controller.resetCampaign();
  }

  // ==========================================================
  // RESET ALL
  // ==========================================================

  resetAll() {
    for (
      const controller
      of this.models.values()
    ) {
      controller.resetCampaign();
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
  CombinedEntryModelManager;
