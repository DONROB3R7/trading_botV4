// ============================================================
// COMBINED ENTRY MODEL CONTROLLER
// ============================================================
// Flow:
//
// IDLE
//   ↓
// PRICE_SIGNAL
//   ↓
// ORDERBOOK_HUNT
//   ↓
// ENTRY
//   ↓
// HUNT_AGAIN
//   ↓
// ORDERBOOK_HUNT
//
// If pyramid is full:
//   → PYRAMID_FULL
//
// If 3 OB cycles expire:
//   → IDLE
//   → Price Model can start again
// ============================================================

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
const REQUIRED_CONFIRMATIONS = 3;
const MAX_PYRAMID = 3;

// Keep enough completed cycles for the frontend.
// This is history only. It does NOT affect trading logic.
const MAX_PREVIOUS_CYCLES = 20;

class CombinedEntryModelController {
  constructor({
    botId,
    symbol = "",
    direction = "NEUTRAL",
  } = {}) {
    this.botId = String(botId || "");
    this.symbol = symbol;

    this.state = STATES.IDLE;

    this.direction = direction;

    this.activeBotId = null;

    this.campaignNumber = 0;

    this.orderbookCycle = 0;
    this.orderbookScan = 0;

    this.confirmations = 0;

    this.pyramidCount = 0;

    this.finalResult = null;

    this.signalActive = false;

    this.running = false;

    // ==========================================================
    // SCAN HISTORY
    // ==========================================================

    // Live scans for the current 15-scan cycle.
    this.currentScans = [];

    // Completed 15-scan cycles.
    this.previousCycles = [];

    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  // ==========================================================
  // INTERNAL
  // ==========================================================

  touch() {
    this.updatedAt = Date.now();
  }

  setState(state) {
    this.state = state;
    this.touch();

    console.log(
      `[Combined] STATE | ` +
        `Bot=${this.botId} | ` +
        `${state}`
    );
  }

  // ==========================================================
  // START / STOP
  // ==========================================================

  start() {
    this.running = true;
    this.touch();

    console.log(
      `[Combined] START | ` +
        `Bot=${this.botId} | ` +
        `Symbol=${this.symbol}`
    );

    return this.getState();
  }

  stop() {
    this.running = false;

    this.touch();

    console.log(
      `[Combined] STOP | ` +
        `Bot=${this.botId}`
    );

    return this.getState();
  }

  // ==========================================================
  // PRICE MODEL SIGNAL
  // ==========================================================

  receivePriceSignal(direction) {
    if (!this.running) {
      return this.getState();
    }

    if (
      direction !== "LONG" &&
      direction !== "SHORT"
    ) {
      console.log(
        `[Combined] SIGNAL IGNORED | ` +
          `Invalid direction=${direction}`
      );

      return this.getState();
    }

    if (
      this.state === STATES.PYRAMID_FULL
    ) {
      console.log(
        `[Combined] SIGNAL BLOCKED | ` +
          `Pyramid full | ` +
          `Bot=${this.botId}`
      );

      return this.getState();
    }

    this.direction = direction;

    this.signalActive = true;

    this.campaignNumber += 1;

    this.orderbookCycle = 0;
    this.orderbookScan = 0;
    this.confirmations = 0;

    this.finalResult = null;

    // New price campaign = new live scan table.
    this.currentScans = [];

    this.setState(
      STATES.PRICE_SIGNAL
    );

    console.log(
      `[Combined] PRICE SIGNAL | ` +
        `Bot=${this.botId} | ` +
        `Direction=${direction} | ` +
        `Campaign=${this.campaignNumber}`
    );

    this.beginOrderbookHunt();

    return this.getState();
  }

  // ==========================================================
  // ORDERBOOK HUNT
  // ==========================================================

  beginOrderbookHunt() {
    if (!this.signalActive) {
      return this.getState();
    }

    if (
      this.pyramidCount >= MAX_PYRAMID
    ) {
      this.finishPyramid();

      return this.getState();
    }

    this.orderbookCycle += 1;

    this.orderbookScan = 0;
    this.confirmations = 0;

    // New orderbook cycle = fresh live scan list.
    this.currentScans = [];

    this.setState(
      STATES.ORDERBOOK_HUNT
    );

    console.log(
      `[Combined] HUNT START | ` +
        `Bot=${this.botId} | ` +
        `Cycle=${this.orderbookCycle}/${MAX_ORDERBOOK_CYCLES}`
    );

    return this.getState();
  }

  // ==========================================================
  // STORE ONE ORDERBOOK SCAN
  // ==========================================================

  storeScan(scanResult = {}) {
    const scan = {
      timestamp:
        scanResult.timestamp ||
        new Date().toISOString(),

      symbol:
        scanResult.symbol ||
        this.symbol,

      depths:
        Array.isArray(scanResult.depths)
          ? scanResult.depths
          : [],

      decision:
        scanResult.decision ||
        "NEUTRAL",

      confirmed:
        Boolean(
          scanResult.confirmed
        ),

      scanNumber:
        this.orderbookScan,

      cycle:
        this.orderbookCycle,

      campaign:
        this.campaignNumber,
    };

    this.currentScans.push(scan);

    // Safety: never allow more than 15 live rows.
    if (
      this.currentScans.length >
      SCANS_PER_CYCLE
    ) {
      this.currentScans =
        this.currentScans.slice(
          -SCANS_PER_CYCLE
        );
    }
  }

  // ==========================================================
  // ORDERBOOK SCAN
  // ==========================================================

  processOrderbookScan({
    confirmed = false,
    scan = null,
  } = {}) {
    if (
      !this.running ||
      !this.signalActive ||
      this.state !== STATES.ORDERBOOK_HUNT
    ) {
      return this.getState();
    }

    this.orderbookScan += 1;

    if (confirmed) {
      this.confirmations += 1;
    }

    // --------------------------------------------------------
    // SAVE REAL SCAN RESULT
    // --------------------------------------------------------

    if (scan) {
      this.storeScan({
        ...scan,
        confirmed,
      });
    } else {
      // Fallback row if scanner does not yet send details.
      // This keeps the controller safe during transition.
      this.storeScan({
        symbol: this.symbol,
        depths: [],
        decision: confirmed
          ? this.direction
          : "NEUTRAL",
        confirmed,
      });
    }

    this.touch();

    console.log(
      `[Combined] OB SCAN | ` +
        `Bot=${this.botId} | ` +
        `Cycle=${this.orderbookCycle}/${MAX_ORDERBOOK_CYCLES} | ` +
        `Scan=${this.orderbookScan}/${SCANS_PER_CYCLE} | ` +
        `Confirm=${this.confirmations}/${REQUIRED_CONFIRMATIONS}`
    );

    // --------------------------------------------------------
    // ENTRY CONFIRMED
    // --------------------------------------------------------

    if (
      this.confirmations >=
      REQUIRED_CONFIRMATIONS
    ) {
      this.beginEntry();

      return this.getState();
    }

    // --------------------------------------------------------
    // CURRENT 15-SCAN CYCLE FINISHED
    // --------------------------------------------------------

    if (
      this.orderbookScan >=
      SCANS_PER_CYCLE
    ) {
      this.finishOrderbookCycle();
    }

    return this.getState();
  }

  // ==========================================================
  // SAVE COMPLETED CYCLE
  // ==========================================================

  savePreviousCycle() {
    const cycle = {
      completedAt:
        new Date().toISOString(),

      campaign:
        this.campaignNumber,

      cycle:
        this.orderbookCycle,

      symbol:
        this.symbol,

      direction:
        this.direction,

      confirmations:
        this.confirmations,

      requiredConfirmations:
        REQUIRED_CONFIRMATIONS,

      scans:
        this.orderbookScan,

      totalScans:
        this.currentScans.length,

      decision:
        this.confirmations >=
        REQUIRED_CONFIRMATIONS
          ? this.direction
          : "EXPIRED",

      finalResult:
        this.confirmations >=
        REQUIRED_CONFIRMATIONS
          ? "CONFIRMED"
          : "EXPIRED",

      scanResults:
        [...this.currentScans],
    };

    this.previousCycles.unshift(
      cycle
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
  }

  // ==========================================================
  // CYCLE EXPIRED
  // ==========================================================

  finishOrderbookCycle() {
    console.log(
      `[Combined] HUNT CYCLE EXPIRED | ` +
        `Bot=${this.botId} | ` +
        `Cycle=${this.orderbookCycle}/${MAX_ORDERBOOK_CYCLES}`
    );

    // Save the completed 15-scan cycle
    // before starting the next one.
    this.savePreviousCycle();

    if (
      this.orderbookCycle >=
      MAX_ORDERBOOK_CYCLES
    ) {
      this.expireSignal();

      return this.getState();
    }

    this.orderbookScan = 0;
    this.confirmations = 0;

    this.beginOrderbookHunt();

    return this.getState();
  }

  // ==========================================================
  // ENTRY
  // ==========================================================

  beginEntry() {
    this.setState(
      STATES.ENTRY
    );

    console.log(
      `[Combined] ENTRY READY | ` +
        `Bot=${this.botId} | ` +
        `Direction=${this.direction} | ` +
        `Pyramid=${this.pyramidCount}/${MAX_PYRAMID}`
    );

    return this.getState();
  }


  // ==========================================================
  // ENTRY RESULT
  // ==========================================================

  handleEntryResult({
    success = false,
    botId = null,
  } = {}) {
    if (
      this.state !== STATES.ENTRY
    ) {
      return this.getState();
    }

    if (botId !== null) {
      this.activeBotId =
        String(botId);
    }

    if (!success) {
      console.log(
        `[Combined] ENTRY FAILED | ` +
          `Bot=${this.botId}`
      );

      this.setState(
        STATES.ORDERBOOK_HUNT
      );

      this.orderbookScan = 0;
      this.confirmations = 0;

      this.currentScans = [];

      return this.getState();
    }

    this.pyramidCount += 1;

    console.log(
      `[Combined] ENTRY SUCCESS | ` +
        `Bot=${this.botId} | ` +
        `Pyramid=${this.pyramidCount}/${MAX_PYRAMID}`
    );

    // --------------------------------------------------------
    // PYRAMID FULL
    // --------------------------------------------------------

    if (
      this.pyramidCount >= MAX_PYRAMID
    ) {
      this.finishPyramid();

      return this.getState();
    }

    // --------------------------------------------------------
    // ENTRY SUCCEEDED
    //
    // IMPORTANT:
    // Do NOT go directly back to Orderbook.
    //
    // Wait for the next Price Model signal.
    // --------------------------------------------------------

    this.signalActive = false;

    this.orderbookCycle = 0;
    this.orderbookScan = 0;
    this.confirmations = 0;

    this.currentScans = [];

    this.finalResult =
      "ENTRY_COMPLETE";

    this.setState(
      STATES.IDLE
    );

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
    this.signalActive = false;

    this.finalResult =
      "PYRAMID_FULL";

    this.setState(
      STATES.PYRAMID_FULL
    );

    console.log(
      `[Combined] PYRAMID FULL | ` +
        `Bot=${this.botId} | ` +
        `Pyramid=${this.pyramidCount}/${MAX_PYRAMID}`
    );

    return this.getState();
  }

  // ==========================================================
  // SIGNAL EXPIRED
  // ==========================================================

  expireSignal() {
    this.signalActive = false;

    this.finalResult =
      "SIGNAL_EXPIRED";

    this.orderbookCycle = 0;
    this.orderbookScan = 0;
    this.confirmations = 0;

    this.currentScans = [];

    this.setState(
      STATES.IDLE
    );

    console.log(
      `[Combined] SIGNAL EXPIRED | ` +
        `Bot=${this.botId}`
    );

    return this.getState();
  }

  // ==========================================================
  // RESET CAMPAIGN
  // ==========================================================

  resetCampaign() {
    this.signalActive = false;

    this.direction = "NEUTRAL";

    this.activeBotId = null;

    this.orderbookCycle = 0;
    this.orderbookScan = 0;

    this.confirmations = 0;

    this.pyramidCount = 0;

    this.finalResult = null;

    this.currentScans = [];
    this.previousCycles = [];

    this.setState(
      STATES.IDLE
    );

    return this.getState();
  }

  // ==========================================================
  // STATUS
  // ==========================================================

  getState() {
    return {
      botId:
        this.botId,

      symbol:
        this.symbol,

      running:
        this.running,

      state:
        this.state,

      direction:
        this.direction,

      campaignNumber:
        this.campaignNumber,

      activeBotId:
        this.activeBotId,

      orderbookCycle:
        this.orderbookCycle,

      maxOrderbookCycles:
        MAX_ORDERBOOK_CYCLES,

      orderbookScan:
        this.orderbookScan,

      scansPerCycle:
        SCANS_PER_CYCLE,

      confirmations:
        this.confirmations,

      requiredConfirmations:
        REQUIRED_CONFIRMATIONS,

      pyramidCount:
        this.pyramidCount,

      maxPyramid:
        MAX_PYRAMID,

      signalActive:
        this.signalActive,

      finalResult:
        this.finalResult,

      // ======================================================
      // LIVE SCAN DATA
      // ======================================================

      currentScans:
        this.currentScans,

      // ======================================================
      // COMPLETED CYCLE HISTORY
      // ======================================================

      previousCycles:
        this.previousCycles,

      updatedAt:
        this.updatedAt,
    };
  }
}

CombinedEntryModelController.STATES =
  STATES;

module.exports =
  CombinedEntryModelController;