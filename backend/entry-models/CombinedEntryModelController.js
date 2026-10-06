// backend/entry-models/combinedEntryModelController.js

const STATES = {
  IDLE: "IDLE",
  PRICE_SIGNAL: "PRICE_SIGNAL",
  ORDERBOOK_HUNT: "ORDERBOOK_HUNT",
  ENTRY: "ENTRY",
  HUNT_AGAIN: "HUNT_AGAIN",
  PYRAMID_FULL: "PYRAMID_FULL",
};

const MAX_ORDERBOOK_CYCLES = 3;
const SCANS_PER_CYCLE = 15;
// Here 3 it's just for testing, for normal trading use 5 or 6 confirmations, but for testing 3 it's enough
const REQUIRED_CONFIRMATIONS = 5;
const MAX_PYRAMID = 3;
const MAX_PREVIOUS_CYCLES = 20;

class CombinedEntryModelController {
  constructor(botId, symbol) {
    this.botId = botId;
    this.symbol = symbol;

    // ==========================================================
    // STATE
    // ==========================================================

    this.state = STATES.IDLE;

    this.direction = null;
    this.activeBotId = null;

    this.campaignNumber = 0;

    // ==========================================================
    // ORDERBOOK STATE
    // ==========================================================

    this.orderbookCycle = 0;
    this.orderbookScans = 0;
    this.confirmations = 0;

    // ==========================================================
    // PYRAMID STATE
    // ==========================================================

    this.pyramidCount = 0;

    // ==========================================================
    // RESULT STATE
    // ==========================================================

    this.finalResult = null;

    this.signalActive = false;
    this.running = false;

    // ==========================================================
    // HISTORY
    // ==========================================================

    this.previousCycles = [];

    this.currentCycleScans = [];

    // ==========================================================
    // TIMESTAMPS
    // ==========================================================

    this.createdAt = Date.now();
    this.updatedAt = Date.now();

    console.log(
      `[Combined] Controller created | ` +
      `Bot=${this.botId} | ` +
      `Symbol=${this.symbol}`
    );
  }

  // ==========================================================
  // START
  // ==========================================================

  start() {
    this.running = true;
    this.updatedAt = Date.now();

    console.log(
      `[Combined] START | ` +
      `Bot=${this.botId} | ` +
      `Symbol=${this.symbol}`
    );

    return this.getState();
  }

  // ==========================================================
  // STOP
  // ==========================================================

  stop() {
    this.running = false;
    this.updatedAt = Date.now();

    console.log(
      `[Combined] STOP | ` +
      `Bot=${this.botId}`
    );

    return this.getState();
  }

  // ==========================================================
  // RECEIVE PRICE MODEL SIGNAL
  // ==========================================================

  receivePriceSignal(direction) {
    this.updatedAt = Date.now();

    if (!this.running) {
      console.log(
        `[Combined] PRICE SIGNAL IGNORED | ` +
        `Bot=${this.botId} | ` +
        `Reason=Controller not running`
      );

      return this.getState();
    }

    const normalizedDirection =
      String(direction || "").toUpperCase();

    if (
      normalizedDirection !== "LONG" &&
      normalizedDirection !== "SHORT"
    ) {
      console.log(
        `[Combined] PRICE SIGNAL IGNORED | ` +
        `Bot=${this.botId} | ` +
        `Direction=${direction}`
      );

      return this.getState();
    }

    // ========================================================
    // PYRAMID FULL
    // ========================================================

    if (this.state === STATES.PYRAMID_FULL) {
      console.log(
        `[Combined] PRICE SIGNAL IGNORED | ` +
        `Bot=${this.botId} | ` +
        `Reason=PYRAMID_FULL`
      );

      return this.getState();
    }

    // ========================================================
    // NEW PRICE SIGNAL
    // ========================================================

    this.direction = normalizedDirection;

    this.signalActive = true;

    this.campaignNumber += 1;

    this.orderbookCycle = 0;
    this.orderbookScans = 0;
    this.confirmations = 0;

    this.currentCycleScans = [];

    this.finalResult = null;

    this.state = STATES.PRICE_SIGNAL;

    console.log(
      `[Combined] PRICE SIGNAL | ` +
      `Bot=${this.botId} | ` +
      `Direction=${this.direction} | ` +
      `Campaign=${this.campaignNumber}`
    );

    // Immediately move into orderbook hunt.

    return this.beginOrderbookHunt();
  }

  // ==========================================================
  // BEGIN ORDERBOOK HUNT
  // ==========================================================

  beginOrderbookHunt() {
    this.updatedAt = Date.now();

    if (!this.running) {
      return this.getState();
    }

    this.orderbookCycle += 1;

    this.orderbookScans = 0;
    this.confirmations = 0;

    this.currentCycleScans = [];

    this.state = STATES.ORDERBOOK_HUNT;

    console.log(
      `[Combined] ORDERBOOK HUNT | ` +
      `Bot=${this.botId} | ` +
      `Direction=${this.direction} | ` +
      `Campaign=${this.campaignNumber} | ` +
      `Cycle=${this.orderbookCycle}/${MAX_ORDERBOOK_CYCLES}`
    );

    return this.getState();
  }

  // ==========================================================
  // PROCESS ORDERBOOK SCAN
  // ==========================================================

  processOrderbookScan(scanResult = {}) {
    this.updatedAt = Date.now();

    if (!this.running) {
      return this.getState();
    }

    if (this.state !== STATES.ORDERBOOK_HUNT) {
      console.log(
        `[Combined] ORDERBOOK SCAN IGNORED | ` +
        `Bot=${this.botId} | ` +
        `State=${this.state}`
      );

      return this.getState();
    }

    this.orderbookScans += 1;

    // ========================================================
    // STORE SCAN
    // ========================================================

    const scan = {
      scanNumber: this.orderbookScans,
      cycle: this.orderbookCycle,
      direction: this.direction,

      confirmed:
        scanResult.confirmed === true,

      timestamp: Date.now(),

      ...scanResult,
    };

    this.currentCycleScans.push(scan);

    // ========================================================
    // CONFIRMATION
    // ========================================================

    if (scan.confirmed) {
      this.confirmations += 1;

      console.log(
        `[Combined] ORDERBOOK CONFIRMATION | ` +
        `Bot=${this.botId} | ` +
        `Direction=${this.direction} | ` +
        `Cycle=${this.orderbookCycle} | ` +
        `Scan=${this.orderbookScans}/${SCANS_PER_CYCLE} | ` +
        `Confirmations=${this.confirmations}/${REQUIRED_CONFIRMATIONS}`
      );
    }

    // ========================================================
    // ENTRY QUALIFIED
    // ========================================================

    if (
      this.confirmations >=
      REQUIRED_CONFIRMATIONS
    ) {
      return this.beginEntry();
    }

    // ========================================================
    // CURRENT CYCLE FINISHED
    // ========================================================

    if (
      this.orderbookScans >=
      SCANS_PER_CYCLE
    ) {
      return this.finishOrderbookCycle();
    }

    return this.getState();
  }

  // ==========================================================
  // FINISH ORDERBOOK CYCLE
  // ==========================================================

  finishOrderbookCycle() {
    this.updatedAt = Date.now();

    // ========================================================
    // SAVE COMPLETED CYCLE
    // ========================================================

    const completedCycle = {
      cycle: this.orderbookCycle,
      campaign: this.campaignNumber,
      direction: this.direction,

      scans: this.orderbookScans,
      confirmations: this.confirmations,

      result:
        this.confirmations >=
        REQUIRED_CONFIRMATIONS
          ? "CONFIRMED"
          : "NO_ENTRY",

      completedAt: Date.now(),

      scansData: [
        ...this.currentCycleScans,
      ],
    };

    this.previousCycles.unshift(
      completedCycle
    );

    if (
      this.previousCycles.length >
      MAX_PREVIOUS_CYCLES
    ) {
      this.previousCycles =
        this.previousCycles.slice(
          0,
          MAX_PREVIOUS_CYCLES
        );
    }

    console.log(
      `[Combined] ORDERBOOK CYCLE COMPLETE | ` +
      `Bot=${this.botId} | ` +
      `Direction=${this.direction} | ` +
      `Campaign=${this.campaignNumber} | ` +
      `Cycle=${this.orderbookCycle}/${MAX_ORDERBOOK_CYCLES} | ` +
      `Scans=${this.orderbookScans} | ` +
      `Confirmations=${this.confirmations}/${REQUIRED_CONFIRMATIONS}`
    );

    // ========================================================
    // IMPORTANT:
    //
    // If we still have orderbook cycles available,
    // start another orderbook hunt using the SAME
    // price signal.
    // ========================================================

    if (
      this.orderbookCycle <
      MAX_ORDERBOOK_CYCLES
    ) {
      console.log(
        `[Combined] ORDERBOOK → NEXT CYCLE | ` +
        `Bot=${this.botId} | ` +
        `NextCycle=${this.orderbookCycle + 1}/${MAX_ORDERBOOK_CYCLES}`
      );

      return this.beginOrderbookHunt();
    }

    // ========================================================
    // ALL ORDERBOOK CYCLES FAILED
    //
    // OLD WRONG BEHAVIOR:
    //   expire signal and stay IDLE.
    //
    // CORRECT BEHAVIOR:
    //   finish this price signal and return control
    //   to the Price Model.
    //
    // The Price Model must start a completely fresh
    // price cycle.
    // ========================================================

    console.log(
      `[Combined] ORDERBOOK EXHAUSTED | ` +
      `Bot=${this.botId} | ` +
      `Campaign=${this.campaignNumber} | ` +
      `Cycles=${MAX_ORDERBOOK_CYCLES} | ` +
      `Result=RETURN_TO_PRICE_MODEL`
    );

    this.signalActive = false;

    this.orderbookScans = 0;
    this.confirmations = 0;

    this.currentCycleScans = [];

    this.finalResult =
      "RETURN_TO_PRICE_MODEL";

    this.state = STATES.IDLE;

    console.log(
      `[Combined] RETURN TO PRICE MODEL | ` +
      `Bot=${this.botId} | ` +
      `PreviousDirection=${this.direction}`
    );

    return this.getState();
  }

  // ==========================================================
  // BEGIN ENTRY
  // ==========================================================

  beginEntry() {
    this.updatedAt = Date.now();

    this.state = STATES.ENTRY;

    this.finalResult = "ENTRY_READY";

    console.log(
      `[Combined] ENTRY READY | ` +
      `Bot=${this.botId} | ` +
      `Direction=${this.direction} | ` +
      `Campaign=${this.campaignNumber} | ` +
      `Pyramid=${this.pyramidCount}/${MAX_PYRAMID}`
    );

    return this.getState();
  }

  // ==========================================================
  // HANDLE ENTRY RESULT
  // ==========================================================

  handleEntryResult(result = {}) {
    this.updatedAt = Date.now();

    const success =
      result.success === true;

    // ========================================================
    // ENTRY FAILED / SKIPPED
    // ========================================================

    if (!success) {
      console.log(
        `[Combined] ENTRY FAILED | ` +
        `Bot=${this.botId} | ` +
        `Direction=${this.direction} | ` +
        `Reason=${result.reason || "UNKNOWN"}`
      );

      this.state = STATES.ORDERBOOK_HUNT;

      this.orderbookScans = 0;
      this.confirmations = 0;

      this.currentCycleScans = [];

      this.finalResult = "ENTRY_FAILED";

      return this.getState();
    }

    // ========================================================
    // ENTRY SUCCESS
    // ========================================================

    this.pyramidCount += 1;

    this.finalResult = "ENTRY_COMPLETE";

    console.log(
      `[Combined] ENTRY SUCCESS | ` +
      `Bot=${this.botId} | ` +
      `Direction=${this.direction} | ` +
      `Pyramid=${this.pyramidCount}/${MAX_PYRAMID}`
    );

    // ========================================================
    // PYRAMID FULL
    // ========================================================

    if (
      this.pyramidCount >=
      MAX_PYRAMID
    ) {
      return this.finishPyramid();
    }

    // ========================================================
    // ENTRY COMPLETE BUT PYRAMID NOT FULL
    //
    // IMPORTANT:
    //
    // Do NOT use HUNT_AGAIN here.
    //
    // BotModels is responsible for starting a
    // completely fresh Price Model cycle.
    // ========================================================

    this.signalActive = false;

    this.orderbookScans = 0;
    this.confirmations = 0;

    this.currentCycleScans = [];

    this.state = STATES.IDLE;

    console.log(
      `[Combined] ENTRY COMPLETE | ` +
      `Bot=${this.botId} | ` +
      `Pyramid=${this.pyramidCount}/${MAX_PYRAMID} | ` +
      `Waiting for NEW PRICE SIGNAL`
    );

    return this.getState();
  }

  // ==========================================================
  // PYRAMID FULL
  // ==========================================================

  finishPyramid() {
    this.updatedAt = Date.now();

    this.signalActive = false;

    this.finalResult =
      "PYRAMID_FULL";

    this.state = STATES.PYRAMID_FULL;

    console.log(
      `[Combined] PYRAMID FULL | ` +
      `Bot=${this.botId} | ` +
      `Direction=${this.direction} | ` +
      `Pyramid=${this.pyramidCount}/${MAX_PYRAMID} | ` +
      `Waiting for position close`
    );

    return this.getState();
  }

  // ==========================================================
  // EXPIRE SIGNAL
  //
  // Kept for compatibility.
  //
  // IMPORTANT:
  // This is no longer used when orderbook cycles are
  // exhausted. Exhaustion now returns to Price Model.
  // ==========================================================

  expireSignal() {
    this.updatedAt = Date.now();

    this.signalActive = false;

    this.orderbookScans = 0;
    this.confirmations = 0;

    this.currentCycleScans = [];

    this.finalResult =
      "SIGNAL_EXPIRED";

    this.state = STATES.IDLE;

    console.log(
      `[Combined] SIGNAL EXPIRED | ` +
      `Bot=${this.botId} | ` +
      `Direction=${this.direction} | ` +
      `Campaign=${this.campaignNumber}`
    );

    return this.getState();
  }

  // ==========================================================
  // RESET CAMPAIGN
  // ==========================================================

  resetCampaign() {
    this.updatedAt = Date.now();

    console.log(
      `[Combined] RESET CAMPAIGN | ` +
      `Bot=${this.botId}`
    );

    this.direction = null;
    this.activeBotId = null;

    this.orderbookCycle = 0;
    this.orderbookScans = 0;
    this.confirmations = 0;

    this.pyramidCount = 0;

    this.finalResult = null;

    this.signalActive = false;

    this.currentCycleScans = [];

    this.previousCycles = [];

    this.state = STATES.IDLE;

    return this.getState();
  }

  // ==========================================================
  // GET STATE
  // ==========================================================

  getState() {
    return {
      botId: this.botId,

      symbol: this.symbol,

      state: this.state,

      direction: this.direction,

      activeBotId: this.activeBotId,

      campaignNumber: this.campaignNumber,

      orderbookCycle:
        this.orderbookCycle,

      orderbookScans:
        this.orderbookScans,

      confirmations:
        this.confirmations,

      pyramidCount:
        this.pyramidCount,

      maxPyramid:
        MAX_PYRAMID,

      finalResult:
        this.finalResult,

      signalActive:
        this.signalActive,

      running:
        this.running,

      previousCycles: [
        ...this.previousCycles,
      ],

      currentCycleScans: [
        ...this.currentCycleScans,
      ],

      updatedAt:
        this.updatedAt,

      createdAt:
        this.createdAt,
    };
  }
}

module.exports =
  CombinedEntryModelController;