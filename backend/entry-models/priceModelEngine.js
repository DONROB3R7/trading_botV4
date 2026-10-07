const MarketData = require("../../market/marketData");

// ============================================================
// PRICE MODEL ENGINE
// ============================================================
//
// PRICE ONLY
//
// BOT BIAS:
//   LONG  -> Trend = LONG
//   SHORT -> Trend = SHORT
//
// TREND:
//   200 candles
//
// ENTRY / PULLBACK:
//   10 / 15 / 20 / 30 / 60 candles
//
// MOVEMENT BASELINE:
//   Last 1000 x 1m candles
//
// CYCLE:
//   10 one-minute scans
//   >= 6 / 10 = cycle direction
//
// SERVER TIMER:
//   Price Model scanning is owned by this backend engine.
//
//   React/page lifecycle does NOT control scanning.
//
// ============================================================

const TREND_CANDLES = 200;

const ENTRY_WINDOWS = [
  20,
  30,
  35,
  60,
  120,
];

const TREND_REQUIRED = 53;

const ENTRY_REQUIRED = 50;

const ENTRY_CONFIRMATIONS_REQUIRED = 3;

const CYCLE_LENGTH = 2;

const CYCLE_REQUIRED = 1;

const HISTORY_LIMIT = 500;

const KLINE_LIMIT = 1000;

// ============================================================
// SERVER SCAN TIMER
// ============================================================

const SCAN_INTERVAL_MS =
  60 * 1000;

// ============================================================
// MOVEMENT EXPERIMENT
// ============================================================

/// Important value for determining if a price movement is significant enough to be considered directional
const MOVEMENT_NEUTRAL_THRESHOLD = 160;

class PriceModelEngine {
  constructor({
    botId,
    symbol = "",
    marketData = null,
    onCycleComplete = null,
  }) {
    this.botId = String(botId);

    this.symbol =
      String(symbol || "")
        .toUpperCase()
        .trim();

    this.marketData =
      marketData ||
      new MarketData();

    // ========================================================
    // PRICE CYCLE CALLBACK
    // ========================================================

    this.onCycleComplete =
      typeof onCycleComplete === "function"
        ? onCycleComplete
        : null;

    // ========================================================
    // RUNTIME
    // ========================================================

    this.running = false;

    this.bias = "NEUTRAL";

    this.scanCount = 0;

    this.cycleNumber = 0;

    this.currentPrice = null;

    this.lastScanAt = null;

    this.lastCycleAt = null;

    this.lastCandleTime = null;

    // ========================================================
    // SERVER TIMER
    // ========================================================

    this.scanTimer = null;

    this.scanRunning = false;

    // ========================================================
    // CURRENT CYCLE
    // ========================================================

    this.currentScans = [];

    // ========================================================
    // COMPLETED CYCLES
    // ========================================================

    this.previousCycles = [];
  }

  // ==========================================================
  // STATE
  // ==========================================================

  getState() {
    return {
      botId: this.botId,

      symbol: this.symbol,

      running: this.running,

      bias: this.bias,

      currentPrice:
        this.currentPrice,

      scanCount:
        this.scanCount,

      cycleNumber:
        this.cycleNumber,

      lastScanAt:
        this.lastScanAt,

      lastCycleAt:
        this.lastCycleAt,

      currentScans:
        this.currentScans,

      previousCycles:
        this.previousCycles,

      config: {
        trendCandles:
          TREND_CANDLES,

        trendRequired:
          TREND_REQUIRED,

        entryWindows:
          [...ENTRY_WINDOWS],

        entryRequired:
          ENTRY_REQUIRED,

        confirmationsRequired:
          ENTRY_CONFIRMATIONS_REQUIRED,

        cycleLength:
          CYCLE_LENGTH,

        cycleRequired:
          CYCLE_REQUIRED,

        historyLimit:
          HISTORY_LIMIT,

        klineLimit:
          KLINE_LIMIT,

        movementNeutralThreshold:
          MOVEMENT_NEUTRAL_THRESHOLD,

        scanIntervalMs:
          SCAN_INTERVAL_MS,
      },
    };
  }

  // ==========================================================
  // START
  // ==========================================================

  async start() {
    if (this.running) {
      console.log(
        `[Price Model] START IGNORED | ` +
        `Already running | ` +
        `Bot=${this.botId}`
      );

      return this.getState();
    }

    this.running = true;

    await this.updateCurrentPrice();

    this.startScanTimer();

    try {
      await this.runAutomaticScan();
    } catch (error) {
      console.error(
        `[Price Model] INITIAL SCAN ERROR | ` +
        `Bot=${this.botId} | ` +
        `${error.message}`
      );
    }

    console.log(
      `[Price Model] START | ` +
      `Bot=${this.botId} | ` +
      `Symbol=${this.symbol} | ` +
      `Bias=${this.bias} | ` +
      `Timer=${SCAN_INTERVAL_MS}ms`
    );

    return this.getState();
  }

  // ==========================================================
  // START SCAN TIMER
  // ==========================================================

  startScanTimer() {
    if (this.scanTimer) {
      clearInterval(
        this.scanTimer
      );

      this.scanTimer = null;
    }

    this.scanTimer =
      setInterval(
        async () => {
          if (!this.running) {
            return;
          }

          await this.runAutomaticScan();
        },
        SCAN_INTERVAL_MS
      );

    console.log(
      `[Price Model] TIMER START | ` +
      `Bot=${this.botId} | ` +
      `Interval=${SCAN_INTERVAL_MS}ms`
    );
  }

  // ==========================================================
  // AUTOMATIC SCAN
  // ==========================================================

  async runAutomaticScan() {
    if (!this.running) {
      return null;
    }

    if (this.scanRunning) {
      console.log(
        `[Price Model] AUTO SCAN SKIPPED | ` +
        `Scan already running | ` +
        `Bot=${this.botId}`
      );

      return null;
    }

    this.scanRunning = true;

    try {
      return await this.runScan();
    } catch (error) {
      console.error(
        `[Price Model] AUTO SCAN ERROR | ` +
        `Bot=${this.botId} | ` +
        `Symbol=${this.symbol} | ` +
        `${error.message}`
      );

      return null;
    } finally {
      this.scanRunning = false;
    }
  }

  // ==========================================================
  // STOP
  // ==========================================================

  stop() {
    this.running = false;

    if (this.scanTimer) {
      clearInterval(
        this.scanTimer
      );

      this.scanTimer = null;
    }

    console.log(
      `[Price Model] STOP | ` +
      `Bot=${this.botId} | ` +
      `Symbol=${this.symbol}`
    );

    return this.getState();
  }

  // ==========================================================
  // BIAS
  // ==========================================================

  setBias(bias) {
    const normalized =
      String(bias || "")
        .trim()
        .toUpperCase();

    if (
      normalized !== "LONG" &&
      normalized !== "SHORT" &&
      normalized !== "NEUTRAL"
    ) {
      throw new Error(
        "Bias must be LONG, SHORT, or NEUTRAL"
      );
    }

    this.bias = normalized;

    console.log(
      `[Price Model] BIAS | ` +
      `Bot=${this.botId} | ` +
      `Bias=${this.bias}`
    );

    return this.getState();
  }

  // ==========================================================
  // CURRENT PRICE
  // ==========================================================

  async updateCurrentPrice() {
    if (!this.symbol) {
      return null;
    }

    const result =
      await this.marketData.getMarkPrice(
        this.symbol
      );

    const price =
      this.extractPrice(result);

    if (
      price !== null &&
      Number.isFinite(price)
    ) {
      this.currentPrice = price;
    }

    return this.currentPrice;
  }

  // ==========================================================
  // EXTRACT PRICE
  // ==========================================================

  extractPrice(result) {
    if (
      result === null ||
      result === undefined
    ) {
      return null;
    }

    if (typeof result === "number") {
      return result;
    }

    if (typeof result === "string") {
      const number = Number(result);

      return Number.isFinite(number)
        ? number
        : null;
    }

    if (typeof result === "object") {
      const candidates = [
        result.markPrice,
        result.price,
        result.lastPrice,
        result.data?.markPrice,
        result.data?.price,
        result.data?.lastPrice,
      ];

      for (const value of candidates) {
        const number = Number(value);

        if (Number.isFinite(number)) {
          return number;
        }
      }
    }

    return null;
  }

  // ==========================================================
  // KLINES
  // ==========================================================

  async getClosedCandles() {
    const raw =
      await this.marketData.getKlines(
        this.symbol,
        "1m",
        KLINE_LIMIT
      );

    return this.normalizeCandles(raw);
  }

  // ==========================================================
  // NORMALIZE CANDLES
  // ==========================================================

  normalizeCandles(raw) {
    let source = raw;

    if (
      source &&
      !Array.isArray(source) &&
      Array.isArray(source.data)
    ) {
      source = source.data;
    }

    if (
      source &&
      !Array.isArray(source) &&
      Array.isArray(source.rows)
    ) {
      source = source.rows;
    }

    if (!Array.isArray(source)) {
      return [];
    }

    const candles = [];

    for (const item of source) {
      let time;
      let open;
      let high;
      let low;
      let close;
      let volume;

      if (Array.isArray(item)) {
        time = item[0];
        open = item[1];
        high = item[2];
        low = item[3];
        close = item[4];
        volume = item[5];
      } else if (
        item &&
        typeof item === "object"
      ) {
        time =
          item.time ??
          item.timestamp ??
          item.ts ??
          item.openTime;

        open =
          item.open ??
          item.o;

        high =
          item.high ??
          item.h;

        low =
          item.low ??
          item.l;

        close =
          item.close ??
          item.c;

        volume =
          item.volume ??
          item.v;
      }

      const parsedTime =
        Number(time);

      const parsedOpen =
        Number(open);

      const parsedHigh =
        Number(high);

      const parsedLow =
        Number(low);

      const parsedClose =
        Number(close);

      if (
        !Number.isFinite(parsedTime) ||
        !Number.isFinite(parsedOpen) ||
        !Number.isFinite(parsedHigh) ||
        !Number.isFinite(parsedLow) ||
        !Number.isFinite(parsedClose)
      ) {
        continue;
      }

      candles.push({
        time: parsedTime,
        open: parsedOpen,
        high: parsedHigh,
        low: parsedLow,
        close: parsedClose,
        volume:
          Number.isFinite(Number(volume))
            ? Number(volume)
            : null,
      });
    }

    candles.sort(
      (a, b) =>
        a.time - b.time
    );

    return candles;
  }

  // ==========================================================
  // HISTORICAL NET MOVEMENT BASELINE
  // ==========================================================

  calculateHistoricalWindowMovement(
    candles,
    windowSize
  ) {
    const movements = [];

    for (
      let i = 0;
      i + windowSize < candles.length;
      i++
    ) {
      const start =
        Number(
          candles[i]?.close
        );

      const end =
        Number(
          candles[
            i + windowSize
          ]?.close
        );

      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start <= 0
      ) {
        continue;
      }

      const move =
        Math.abs(
          (end - start) /
            start
        ) * 100;

      if (Number.isFinite(move)) {
        movements.push(move);
      }
    }

    if (!movements.length) {
      return {
        window: windowSize,
        samples: 0,
        averageMove: null,
        highMove: null,
        extremeMove: null,
        medianMove: null,
        minimumMove: null,
        maximumMove: null,
        rangeMove: null,
        ready: false,
      };
    }

    const sorted =
      [...movements].sort(
        (a, b) => a - b
      );

    const averageMove =
      movements.reduce(
        (sum, value) =>
          sum + value,
        0
      ) /
      movements.length;

    const middle =
      Math.floor(
        sorted.length / 2
      );

    const medianMove =
      sorted.length % 2 === 0
        ? (
            sorted[middle - 1] +
            sorted[middle]
          ) / 2
        : sorted[middle];

    const highCount =
      Math.min(
        4,
        sorted.length
      );

    const topMoves =
      sorted.slice(
        -highCount
      );

    const highMove =
      topMoves.reduce(
        (sum, value) =>
          sum + value,
        0
      ) /
      highCount;

    const extremeMove =
      sorted[
        sorted.length - 1
      ];

    const minimumMove =
      sorted[0];

    const maximumMove =
      sorted[
        sorted.length - 1
      ];

    return {
      window: windowSize,

      samples:
        movements.length,

      averageMove,

      highMove,

      extremeMove,

      medianMove,

      minimumMove,

      maximumMove,

      rangeMove: {
        minimum:
          minimumMove,

        maximum:
          maximumMove,
      },

      ready: true,
    };
  }

  // ==========================================================
  // ALL MOVEMENT BASELINES
  // ==========================================================

  calculateMovementBaselines(
    candles
  ) {
    const baselines = {};

    for (
      const windowSize of
        ENTRY_WINDOWS
    ) {
      baselines[windowSize] =
        this.calculateHistoricalWindowMovement(
          candles,
          windowSize
        );
    }

    return baselines;
  }

  // ==========================================================
  // CURRENT WINDOW MOVEMENT
  // ==========================================================

  calculateWindowMovement(
    candles,
    windowSize,
    baseline
  ) {
    if (
      !Array.isArray(candles) ||
      candles.length <
        windowSize + 1
    ) {
      return {
        window: windowSize,
        normalMove: 0,
        highMove: 0,
        highAverageMove: 0,
        extremeMove: 0,
        actualMove: 0,
        actualMoveAbsolute: 0,
        moveVsNormal: 0,
        moveVsHighAverage: 0,
        movementDirection:
          "NEUTRAL",
        rawMovementDirection:
          "NEUTRAL",
        direction:
          "NEUTRAL",
        ready: false,
      };
    }

    const startIndex =
      candles.length -
      (windowSize + 1);

    const startCandle =
      candles[startIndex];

    const endCandle =
      candles[
        candles.length - 1
      ];

    const startPrice =
      Number(
        startCandle?.close
      );

    const endPrice =
      Number(
        endCandle?.close
      );

    if (
      !Number.isFinite(startPrice) ||
      !Number.isFinite(endPrice) ||
      startPrice === 0
    ) {
      return {
        window: windowSize,

        normalMove:
          Number(
            baseline?.averageMove ||
              0
          ),

        highMove:
          Number(
            baseline?.highMove ||
              0
          ),

        highAverageMove:
          Number(
            baseline?.highMove ||
              0
          ),

        extremeMove:
          Number(
            baseline?.extremeMove ||
              0
          ),

        actualMove: 0,

        actualMoveAbsolute: 0,

        moveVsNormal: 0,

        moveVsHighAverage: 0,

        movementDirection:
          "NEUTRAL",

        rawMovementDirection:
          "NEUTRAL",

        direction:
          "NEUTRAL",

        ready: false,
      };
    }

    const actualMove =
      (
        (endPrice -
          startPrice) /
        startPrice
      ) * 100;

    const actualMoveAbsolute =
      Math.abs(
        actualMove
      );

    const normalMove =
      Number(
        baseline?.averageMove ||
          0
      );

    const highMove =
      Number(
        baseline?.highMove ||
          0
      );

    const extremeMove =
      Number(
        baseline?.extremeMove ||
          0
      );

    const highAverageMove =
      highMove;

    let moveVsNormal = 0;

    if (
      normalMove > 0
    ) {
      moveVsNormal =
        (
          actualMoveAbsolute /
          normalMove
        ) * 100;
    }

    let moveVsHighAverage = 0;

    if (
      highMove > 0
    ) {
      moveVsHighAverage =
        (
          actualMoveAbsolute /
          highMove
        ) * 100;
    }

    let rawMovementDirection =
      "NEUTRAL";

    if (
      actualMove > 0
    ) {
      rawMovementDirection =
        "LONG";
    } else if (
      actualMove < 0
    ) {
      rawMovementDirection =
        "SHORT";
    }

    let movementDirection =
      "NEUTRAL";

    if (
      moveVsNormal >=
      MOVEMENT_NEUTRAL_THRESHOLD
    ) {
      movementDirection =
        rawMovementDirection;
    }

    return {
      window: windowSize,

      normalMove,

      highMove,

      highAverageMove,

      extremeMove,

      actualMove,

      actualMoveAbsolute,

      moveVsNormal,

      moveVsHighAverage,

      rawMovementDirection,

      movementDirection,

      direction:
        movementDirection,

      movementNeutral:
        movementDirection ===
        "NEUTRAL",

      movementThreshold:
        MOVEMENT_NEUTRAL_THRESHOLD,

      startPrice,

      endPrice,

      startCandleTime:
        startCandle?.time ??
        null,

      endCandleTime:
        endCandle?.time ??
        null,

      ready:
        baseline?.ready ===
        true,
    };
  }

  // ==========================================================
  // DIRECTIONAL STRENGTH
  // ==========================================================

  calculateDirectionalStrength(
    candles,
    windowSize,
    required
  ) {
    if (
      !Array.isArray(candles) ||
      candles.length <
        windowSize + 1
    ) {
      return {
        window: windowSize,
        direction: "NEUTRAL",
        rawDirection: "NEUTRAL",
        strength: 0,
        upStrength: 0,
        downStrength: 0,
        upMovement: 0,
        downMovement: 0,
        totalMovement: 0,
        ready: false,
      };
    }

    const start =
      candles.length -
      (windowSize + 1);

    const windowCandles =
      candles.slice(start);

    let upMovement = 0;

    let downMovement = 0;

    for (
      let i = 1;
      i < windowCandles.length;
      i++
    ) {
      const previous =
        Number(
          windowCandles[
            i - 1
          ].close
        );

      const current =
        Number(
          windowCandles[i]
            .close
        );

      if (
        !Number.isFinite(previous) ||
        !Number.isFinite(current) ||
        previous === 0
      ) {
        continue;
      }

      const change =
        (
          (current -
            previous) /
          previous
        ) * 100;

      if (
        change > 0
      ) {
        upMovement +=
          change;
      } else if (
        change < 0
      ) {
        downMovement +=
          Math.abs(change);
      }
    }

    const totalMovement =
      upMovement +
      downMovement;

    if (
      totalMovement <= 0
    ) {
      return {
        window: windowSize,
        direction: "NEUTRAL",
        rawDirection: "NEUTRAL",
        strength: 0,
        upStrength: 0,
        downStrength: 0,
        upMovement,
        downMovement,
        totalMovement,
        ready: true,
      };
    }

    const upStrength =
      (
        upMovement /
        totalMovement
      ) * 100;

    const downStrength =
      (
        downMovement /
        totalMovement
      ) * 100;

    let rawDirection =
      "NEUTRAL";

    let direction =
      "NEUTRAL";

    let strength = 0;

    if (
      upStrength >=
      downStrength
    ) {
      rawDirection =
        "LONG";

      strength =
        upStrength;

      if (
        upStrength >=
        required
      ) {
        direction =
          "LONG";
      }
    } else {
      rawDirection =
        "SHORT";

      strength =
        downStrength;

      if (
        downStrength >=
        required
      ) {
        direction =
          "SHORT";
      }
    }

    return {
      window: windowSize,

      direction,

      rawDirection,

      strength,

      upStrength,

      downStrength,

      upMovement,

      downMovement,

      totalMovement,

      ready: true,
    };
  }

  // ==========================================================
  // TREND
  // ==========================================================

  calculateTrend(
    candles
  ) {
    const calculatedTrend =
      this.calculateDirectionalStrength(
        candles,
        TREND_CANDLES,
        TREND_REQUIRED
      );

    if (
      this.bias === "LONG"
    ) {
      return {
        ...calculatedTrend,

        direction:
          "LONG",

        rawDirection:
          calculatedTrend.rawDirection,

        botBias:
          "LONG",
      };
    }

    if (
      this.bias === "SHORT"
    ) {
      return {
        ...calculatedTrend,

        direction:
          "SHORT",

        rawDirection:
          calculatedTrend.rawDirection,

        botBias:
          "SHORT",
      };
    }

    return {
      ...calculatedTrend,

      botBias:
        "NEUTRAL",
    };
  }

  // ==========================================================
  // ENTRY WINDOW
  // ==========================================================

  calculateEntry(
    candles,
    windowSize,
    movementBaseline
  ) {
    const directional =
      this.calculateDirectionalStrength(
        candles,
        windowSize,
        ENTRY_REQUIRED
      );

    const movement =
      this.calculateWindowMovement(
        candles,
        windowSize,
        movementBaseline
      );

    return {
      ...directional,

      direction:
        movement.direction,

      movement,
    };
  }

  // ==========================================================
  // ENTRY CONFIRMATION / PULLBACK
  // ==========================================================

  calculateEntryConfirmation(
    entries,
    trend
  ) {
    const list =
      ENTRY_WINDOWS.map(
        (windowSize) =>
          entries[windowSize]
      );

    let rawLongVotes = 0;

    let rawShortVotes = 0;

    let neutralVotes = 0;

    for (
      const entry of list
    ) {
      const direction =
        entry?.direction ||
        "NEUTRAL";

      if (
        direction === "LONG"
      ) {
        rawLongVotes++;
      } else if (
        direction === "SHORT"
      ) {
        rawShortVotes++;
      } else {
        neutralVotes++;
      }
    }

    let longVotes = 0;

    let shortVotes = 0;

    let decision =
      "NEUTRAL";

    let confirmed =
      false;

    if (
      trend?.direction ===
      "LONG"
    ) {
      longVotes =
        rawLongVotes;

      shortVotes =
        rawShortVotes;

      if (
        rawShortVotes >=
        ENTRY_CONFIRMATIONS_REQUIRED
      ) {
        decision =
          "LONG";

        confirmed =
          true;
      }
    } else if (
      trend?.direction ===
      "SHORT"
    ) {
      shortVotes =
        rawShortVotes;

      longVotes =
        rawLongVotes;

      if (
        rawLongVotes >=
        ENTRY_CONFIRMATIONS_REQUIRED
      ) {
        decision =
          "SHORT";

        confirmed =
          true;
      }
    }

    return {
      trendDirection:
        trend?.direction ||
        "NEUTRAL",

      rawLongVotes,

      rawShortVotes,

      neutralVotes,

      longVotes,

      shortVotes,

      required:
        ENTRY_CONFIRMATIONS_REQUIRED,

      decision,

      confirmed,
    };
  }

  // ==========================================================
  // SIGNAL SNAPSHOT
  // ==========================================================

  calculateSignalSnapshot(
    candles
  ) {
    const latestCandle =
      candles[
        candles.length - 1
      ];

    const candleTime =
      latestCandle?.time ??
      null;

    const price =
      Number.isFinite(
        Number(
          latestCandle?.close
        )
      )
        ? Number(
            latestCandle.close
          )
        : this.currentPrice;

    const movementBaselines =
      this.calculateMovementBaselines(
        candles
      );

    const trend =
      this.calculateTrend(
        candles
      );

    const entries = {};

    for (
      const windowSize of
        ENTRY_WINDOWS
    ) {
      entries[windowSize] =
        this.calculateEntry(
          candles,
          windowSize,
          movementBaselines[
            windowSize
          ]
        );
    }

    const confirmation =
      this.calculateEntryConfirmation(
        entries,
        trend
      );

    let reason =
      "NEUTRAL";

    if (
      candles.length <
      TREND_CANDLES + 1
    ) {
      reason =
        "NOT_ENOUGH_200_CANDLES";
    } else if (
      this.bias === "NEUTRAL"
    ) {
      reason =
        "NO_BOT_DIRECTION";
    } else if (
      confirmation.decision ===
      "LONG"
    ) {
      reason =
        "LONG_BOT_3_OF_5_SHORT_PULLBACK";
    } else if (
      confirmation.decision ===
      "SHORT"
    ) {
      reason =
        "SHORT_BOT_3_OF_5_LONG_PULLBACK";
    } else {
      reason =
        `${trend.direction}_BOT_PULLBACK_NOT_CONFIRMED`;
    }

    return {
      timestamp:
        new Date().toISOString(),

      candleTime,

      symbol:
        this.symbol,

      timeframe:
        "1m",

      price,

      movementBaseline: {
        candlesUsed:
          candles.length,

        movementNeutralThreshold:
          MOVEMENT_NEUTRAL_THRESHOLD,

        windows:
          movementBaselines,
      },

      trend,

      entries,

      confirmation,

      decision:
        confirmation.decision,

      reason,
    };
  }

  // ==========================================================
  // ADD SCAN TO CURRENT CYCLE
  // ==========================================================

  addScan(
    snapshot
  ) {
    if (!snapshot) {
      return false;
    }

    const candleTime =
      snapshot.candleTime;

    if (
      candleTime !== null &&
      candleTime !== undefined
    ) {
      if (
        this.lastCandleTime ===
        candleTime
      ) {
        return false;
      }

      const duplicate =
        this.currentScans.some(
          (scan) =>
            scan.candleTime ===
            candleTime
        );

      if (duplicate) {
        return false;
      }
    }

    this.currentScans.push(
      snapshot
    );

    this.scanCount =
      this.currentScans.length;

    this.lastCandleTime =
      candleTime;

    return true;
  }

  // ==========================================================
  // COMPLETE CYCLE
  // ==========================================================

  completeCycle() {
    if (
      this.currentScans.length <
      CYCLE_LENGTH
    ) {
      return null;
    }

    const scans = [
      ...this.currentScans,
    ];

    let longVotes = 0;

    let shortVotes = 0;

    let neutralVotes = 0;

    for (
      const scan of scans
    ) {
      if (
        scan.decision ===
        "LONG"
      ) {
        longVotes++;
      } else if (
        scan.decision ===
        "SHORT"
      ) {
        shortVotes++;
      } else {
        neutralVotes++;
      }
    }

    let decision =
      "NEUTRAL";

    if (
      longVotes >
        shortVotes &&
      longVotes >=
        CYCLE_REQUIRED
    ) {
      decision =
        "LONG";
    } else if (
      shortVotes >
        longVotes &&
      shortVotes >=
        CYCLE_REQUIRED
    ) {
      decision =
        "SHORT";
    }

    let reason;

    if (
      decision === "LONG"
    ) {
      reason =
        `CYCLE_LONG_${longVotes}_OF_${CYCLE_LENGTH}`;
    } else if (
      decision === "SHORT"
    ) {
      reason =
        `CYCLE_SHORT_${shortVotes}_OF_${CYCLE_LENGTH}`;
    } else {
      reason =
        `CYCLE_NEUTRAL_${longVotes}L_${shortVotes}S_${neutralVotes}N`;
    }

    const firstScan =
      scans[0];

    const lastScan =
      scans[
        scans.length - 1
      ];

    const cycle = {
      cycleId:
        this.cycleNumber + 1,

      symbol:
        this.symbol,

      timeframe:
        "1m",

      startTime:
        firstScan?.timestamp ??
        null,

      endTime:
        lastScan?.timestamp ??
        null,

      startCandleTime:
        firstScan?.candleTime ??
        null,

      endCandleTime:
        lastScan?.candleTime ??
        null,

      completedAt:
        new Date().toISOString(),

      candles:
        scans,

      trend:
        lastScan?.trend ??
        null,

      entries:
        lastScan?.entries ??
        null,

      votes: {
        long:
          longVotes,

        short:
          shortVotes,

        neutral:
          neutralVotes,
      },

      decision,

      reason,
    };

    this.cycleNumber =
      cycle.cycleId;

    this.lastCycleAt =
      cycle.completedAt;

    this.previousCycles.unshift(
      cycle
    );

    if (
      this.previousCycles.length >
      HISTORY_LIMIT
    ) {
      this.previousCycles =
        this.previousCycles.slice(
          0,
          HISTORY_LIMIT
        );
    }

    this.currentScans = [];

    this.scanCount = 0;

    this.lastCandleTime = null;

    console.log(
      `[Price Model] CYCLE COMPLETE | ` +
      `Bot=${this.botId} | ` +
      `Cycle=${cycle.cycleId} | ` +
      `Decision=${decision} | ` +
      `Votes=${longVotes}L/${shortVotes}S/${neutralVotes}N`
    );

    return cycle;
  }

  // ==========================================================
  // RUN SCAN
  // ==========================================================

  async runScan() {
    if (!this.symbol) {
      throw new Error(
        "Price Model symbol is missing"
      );
    }

    await this.updateCurrentPrice();

    const candles =
      await this.getClosedCandles();

    if (!candles.length) {
      throw new Error(
        "No candle data received"
      );
    }

    const snapshot =
      this.calculateSignalSnapshot(
        candles
      );

    const added =
      this.addScan(
        snapshot
      );

    this.lastScanAt =
      snapshot.timestamp;

    let completedCycle =
      null;

    // ========================================================
    // COMPLETE PRICE CYCLE
    // ========================================================

    if (
      added &&
      this.currentScans.length >=
        CYCLE_LENGTH
    ) {
      completedCycle =
        this.completeCycle();

      // ------------------------------------------------------
      // SIGNAL FOUND
      // ------------------------------------------------------

      if (
        completedCycle &&
        (
          completedCycle.decision === "LONG" ||
          completedCycle.decision === "SHORT"
        )
      ) {
        this.stop();

        console.log(
          `[Price Model] SIGNAL FOUND | ` +
          `Bot=${this.botId} | ` +
          `Decision=${completedCycle.decision} | ` +
          `SCANNING STOPPED`
        );
      }

      // ======================================================
      // SEND COMPLETED PRICE CYCLE TO BOTMODELS
      // ======================================================
      //
      // CRITICAL:
      //
      // BotModels callback signature:
      //
      //   (botId, cycle)
      //
      // Therefore we MUST send:
      //
      //   this.botId
      //   completedCycle
      //
      // NOT:
      //
      //   completedCycle
      //
      // ======================================================

      if (
        completedCycle &&
        this.onCycleComplete
      ) {
        try {
          console.log(
            `[Price Model] CALLBACK → BOTMODELS | ` +
            `Bot=${this.botId} | ` +
            `Cycle=${completedCycle.cycleId} | ` +
            `Decision=${completedCycle.decision}`
          );

          this.onCycleComplete(
            this.botId,
            completedCycle
          );
        } catch (error) {
          console.error(
            `[Price Model] CYCLE CALLBACK ERROR | ` +
            `Bot=${this.botId} | ` +
            `${error.message}`
          );
        }
      }
    }

    console.log(
      `[Price Model] SCAN | ` +
      `Bot=${this.botId} | ` +
      `Candle=${snapshot.candleTime} | ` +
      `Bias=${this.bias} | ` +
      `Trend=${snapshot.trend.direction} ` +
      `${snapshot.trend.strength.toFixed(2)}% | ` +
      `Decision=${snapshot.decision} | ` +
      `Added=${added}`
    );

    return {
      ...this.getState(),

      latestScan:
        snapshot,

      cycleCompleted:
        completedCycle,
    };
  }

  // ==========================================================
  // RESET
  // ==========================================================

  reset() {
    this.stop();

    this.scanCount = 0;

    this.cycleNumber = 0;

    this.currentPrice = null;

    this.lastScanAt = null;

    this.lastCycleAt = null;

    this.lastCandleTime = null;

    this.currentScans = [];

    this.previousCycles = [];

    console.log(
      `[Price Model] RESET | ` +
      `Bot=${this.botId}`
    );

    return this.getState();
  }
}

module.exports = PriceModelEngine;