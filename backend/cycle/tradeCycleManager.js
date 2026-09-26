// ============================================================
// TRADE CYCLE MANAGER
// ============================================================
//
// ONE SHARED SERVER-SIDE MANAGER
//
// Each bot gets its own independent cycle.
//
// No WEEX.
// No orders.
// No React.
// No timers.
//
// This module exports ONE shared manager instance so:
//
// bot.js
//     +
// entryModelEngine.js
//     ↓
// SAME TradeCycleManager
//
// ============================================================

class TradeCycleManager {
  constructor() {
    this.cycles = new Map();

    console.log(
      "[TradeCycleManager] Initialized"
    );
  }

  // ==========================================================
  // CREATE / GET CYCLE
  // ==========================================================

  create(
    botId,
    initialState = {}
  ) {

    if (!botId) {
      throw new Error(
        "TradeCycleManager.create() requires botId"
      );
    }

    if (
      this.cycles.has(
        botId
      )
    ) {

      return this.cycles.get(
        botId
      );
    }

    const cycle = {

      botId,

      // ------------------------------------------------------
      // CYCLE STATUS
      // ------------------------------------------------------

      status:
        "IDLE",

      // ------------------------------------------------------
      // CYCLE NUMBER
      // ------------------------------------------------------

      cycleNumber:
        0,

      // ------------------------------------------------------
      // CURRENT SCAN / STEP
      // ------------------------------------------------------

      step:
        0,

      // ------------------------------------------------------
      // BOT DIRECTION
      // ------------------------------------------------------

      direction:
        null,

      // ------------------------------------------------------
      // POSITION
      // ------------------------------------------------------

      position:
        null,

      // ------------------------------------------------------
      // CYCLE TIMING
      // ------------------------------------------------------

      startedAt:
        null,

      updatedAt:
        Date.now(),

      // ------------------------------------------------------
      // EXTRA STATE
      // ------------------------------------------------------

      ...initialState,
    };

    this.cycles.set(
      botId,
      cycle
    );

    console.log(
      `[TradeCycleManager] Created cycle for ${botId}`
    );

    return cycle;
  }

  // ==========================================================
  // GET
  // ==========================================================

  get(
    botId
  ) {

    return (
      this.cycles.get(
        botId
      ) ||
      null
    );
  }

  // ==========================================================
  // GET OR CREATE
  // ==========================================================

  getOrCreate(
    botId,
    initialState = {}
  ) {

    return (
      this.get(
        botId
      ) ||
      this.create(
        botId,
        initialState
      )
    );
  }

  // ==========================================================
  // UPDATE
  // ==========================================================

  update(
    botId,
    changes = {}
  ) {

    const cycle =
      this.getOrCreate(
        botId
      );

    Object.assign(
      cycle,
      changes
    );

    cycle.updatedAt =
      Date.now();

    return cycle;
  }

  // ==========================================================
  // START
  // ==========================================================

  start(
    botId,
    data = {}
  ) {

    const cycle =
      this.getOrCreate(
        botId
      );

    cycle.status =
      "RUNNING";

    cycle.cycleNumber +=
      1;

    cycle.step =
      0;

    cycle.startedAt =
      Date.now();

    Object.assign(
      cycle,
      data
    );

    cycle.updatedAt =
      Date.now();

    console.log(
      `[TradeCycleManager] ${botId} cycle started #${cycle.cycleNumber}`
    );

    return cycle;
  }

  // ==========================================================
  // NEXT STEP
  // ==========================================================

  nextStep(
    botId
  ) {

    const cycle =
      this.getOrCreate(
        botId
      );

    cycle.step +=
      1;

    cycle.updatedAt =
      Date.now();

    return cycle;
  }

  // ==========================================================
  // STOP
  // ==========================================================

  stop(
    botId,
    data = {}
  ) {

    const cycle =
      this.get(
        botId
      );

    if (!cycle) {
      return null;
    }

    cycle.status =
      "STOPPED";

    Object.assign(
      cycle,
      data
    );

    cycle.updatedAt =
      Date.now();

    console.log(
      `[TradeCycleManager] ${botId} cycle stopped`
    );

    return cycle;
  }

  // ==========================================================
  // RESET
  // ==========================================================

  reset(
    botId
  ) {

    const cycle =
      this.get(
        botId
      );

    if (!cycle) {
      return null;
    }

    cycle.status =
      "IDLE";

    cycle.step =
      0;

    cycle.direction =
      null;

    cycle.position =
      null;

    cycle.startedAt =
      null;

    cycle.updatedAt =
      Date.now();

    return cycle;
  }

  // ==========================================================
  // REMOVE
  // ==========================================================

  remove(
    botId
  ) {

    const existed =
      this.cycles.delete(
        botId
      );

    if (existed) {

      console.log(
        `[TradeCycleManager] Removed ${botId}`
      );

    }

    return existed;
  }

  // ==========================================================
  // GET ALL
  // ==========================================================

  getAll() {

    return Array.from(
      this.cycles.values()
    );
  }

  // ==========================================================
  // HAS
  // ==========================================================

  has(
    botId
  ) {

    return this.cycles.has(
      botId
    );
  }
}

// ============================================================
// ONE SHARED INSTANCE
// ============================================================

const tradeCycleManager =
  new TradeCycleManager();

module.exports =
  tradeCycleManager;