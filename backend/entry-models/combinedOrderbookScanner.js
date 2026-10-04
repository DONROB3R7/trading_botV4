const OrderbookEntryModel =
  require("./orderbookEntryModel");

const SCAN_INTERVAL_MS = 20 * 1000;

class CombinedOrderbookScanner {
  constructor({
    combinedEntryModelManager,
  } = {}) {
    this.combinedEntryModelManager =
      combinedEntryModelManager;

    this.orderbookModel =
      new OrderbookEntryModel();

    this.timers = new Map();
    this.running = new Map();
    this.scanning = new Map();

    // ========================================================
    // ENTRY HANDLER
    // ========================================================
    //
    // Called when Combined Entry Model reaches ENTRY.
    //
    // The actual handler will be connected by bots.js.
    //
    this.entryHandler =
      null;

    console.log(
      "[Combined OB Scanner] Initialized"
    );
  }

  // ==========================================================
  // SET ENTRY HANDLER
  // ==========================================================

  setEntryHandler(handler) {
    if (
      typeof handler !== "function"
    ) {
      this.entryHandler = null;

      console.log(
        "[Combined OB Scanner] Entry handler CLEARED"
      );

      return;
    }

    this.entryHandler =
      handler;

    console.log(
      "[Combined OB Scanner] Entry handler CONNECTED"
    );
  }

  // ==========================================================
  // START
  // ==========================================================

  start(botId) {
    const id = String(botId);

    if (this.running.get(id)) {
      console.log(
        `[Combined OB Scanner] Already running | Bot=${id}`
      );

      return;
    }

    this.running.set(id, true);

    console.log(
      `[Combined OB Scanner] START | Bot=${id} | Interval=20s`
    );

    // First scan immediately.
    this.runScan(id);

    // Then every 20 seconds.
    const timer = setInterval(() => {
      this.runScan(id);
    }, SCAN_INTERVAL_MS);

    this.timers.set(id, timer);
  }

  // ==========================================================
  // STOP
  // ==========================================================

  stop(botId) {
    const id = String(botId);

    this.running.set(id, false);

    const timer = this.timers.get(id);

    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
    }

    console.log(
      `[Combined OB Scanner] STOP | Bot=${id}`
    );
  }

  // ==========================================================
  // RUN ONE SCAN
  // ==========================================================

  async runScan(botId) {
    const id = String(botId);

    if (!this.running.get(id)) {
      return;
    }

    // Prevent overlapping WEEX requests.
    if (this.scanning.get(id)) {
      console.log(
        `[Combined OB Scanner] SKIP | Bot=${id} | Previous scan still running`
      );

      return;
    }

    const combined =
      this.combinedEntryModelManager.get(id);

    if (!combined) {
      console.log(
        `[Combined OB Scanner] NO MODEL | Bot=${id}`
      );

      return;
    }

    const state =
      combined.getState();

    // Only scan while Combined is actively hunting.
    if (
      !state.running ||
      state.state !== "ORDERBOOK_HUNT" ||
      !state.signalActive
    ) {
      return;
    }

    if (
      state.direction !== "LONG" &&
      state.direction !== "SHORT"
    ) {
      console.log(
        `[Combined OB Scanner] NO DIRECTION | Bot=${id}`
      );

      return;
    }

    if (!state.symbol) {
      console.log(
        `[Combined OB Scanner] NO SYMBOL | Bot=${id}`
      );

      return;
    }

    this.scanning.set(id, true);

    try {
      console.log(
        `[Combined OB Scanner] SCAN | ` +
          `Bot=${id} | ` +
          `Symbol=${state.symbol} | ` +
          `Direction=${state.direction} | ` +
          `Cycle=${state.orderbookCycle}/${state.maxOrderbookCycles} | ` +
          `Scan=${state.orderbookScan + 1}/${state.scansPerCycle}`
      );

      // ======================================================
      // REAL WEEX ORDERBOOK SCAN
      // ======================================================

      const result =
        await this.orderbookModel.scan(
          state.symbol,
          state.direction
        );

      // ======================================================
      // CONFIRMATION
      // ======================================================

        const confirmed =
        Boolean(
          result &&
          result.directionConfirmed === true &&
          result.decision === state.direction
        );
        
      console.log(
        `[Combined OB Scanner] RESULT | ` +
          `Bot=${id} | ` +
          `Decision=${result?.decision || "UNKNOWN"} | ` +
          `Confirmed=${confirmed}`
      );

      // ======================================================
      // SEND COMPLETE SCAN RESULT TO CONTROLLER
      // ======================================================

      const nextState =
        combined.processOrderbookScan({
          confirmed,

          scan: {
            ...result,

            timestamp:
              new Date().toISOString(),

            symbol:
              result?.symbol ||
              state.symbol,

            decision:
              result?.decision ||
              "NEUTRAL",
          },
        });

      console.log(
        `[Combined OB Scanner] STATE | ` +
          `Bot=${id} | ` +
          `State=${nextState.state} | ` +
          `Confirmations=${nextState.confirmations}/${nextState.requiredConfirmations}`
      );

      // ======================================================
      // ENTRY READY
      // ======================================================

      if (
        nextState.state === "ENTRY"
      ) {
        this.stop(id);

        console.log(
          `[Combined OB Scanner] ENTRY READY | Bot=${id}`
        );

        // ====================================================
        // EXECUTION BRIDGE
        // ====================================================
        //
        // IMPORTANT:
        //
        // The scanner does NOT open the order itself.
        //
        // It calls the existing BotEntry system.
        //
        // BotEntry will handle:
        //
        //   BotEntry.enter()
        //        ↓
        //   orders.openTestPosition()
        //        ↓
        //   WEEX
        //        ↓
        //   TradeLifecycle
        //
        // ====================================================

        if (
          typeof this.entryHandler ===
            "function"
        ) {

          try {

            await this.entryHandler({
              botId: id,
              state: nextState,
              scan: result,
            });

          } catch (error) {

            console.error(
              `[Combined OB Scanner] ENTRY HANDLER ERROR | ` +
                `Bot=${id} | ${error.message}`
            );

          }

        } else {

          console.warn(
            `[Combined OB Scanner] ENTRY HANDLER NOT CONNECTED | ` +
              `Bot=${id}`
          );

        }
      }

      // ======================================================
      // PYRAMID FULL
      // ======================================================

      if (
        nextState.state === "PYRAMID_FULL"
      ) {
        this.stop(id);

        console.log(
          `[Combined OB Scanner] PYRAMID FULL | Bot=${id}`
        );
      }

      // ======================================================
      // SIGNAL EXPIRED
      // ======================================================

      if (
        nextState.state === "IDLE" &&
        nextState.finalResult ===
          "SIGNAL_EXPIRED"
      ) {
        this.stop(id);

        console.log(
          `[Combined OB Scanner] SIGNAL EXPIRED | Bot=${id}`
        );
      }

    } catch (error) {

      console.error(
        `[Combined OB Scanner] ERROR | ` +
          `Bot=${id} | ${error.message}`
      );

    } finally {

      this.scanning.set(id, false);

    }
  }

  // ==========================================================
  // STATUS
  // ==========================================================

  isRunning(botId) {
    return (
      this.running.get(
        String(botId)
      ) === true
    );
  }

  // ==========================================================
  // STOP ALL
  // ==========================================================

  stopAll() {
    for (
      const botId of this.running.keys()
    ) {
      this.stop(botId);
    }

    this.running.clear();
    this.scanning.clear();

    console.log(
      "[Combined OB Scanner] ALL STOPPED"
    );
  }
}

module.exports =
  CombinedOrderbookScanner;