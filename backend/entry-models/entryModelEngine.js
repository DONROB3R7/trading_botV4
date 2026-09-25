// ============================================================
// ENTRY MODEL ENGINE
// ============================================================
//
// SERVER-SIDE IN-MEMORY ENGINE
//
// One independent engine per bot.
//
// IMPORTANT:
// - Does NOT open trades
// - Does NOT close trades
// - Does NOT modify positions
// - Does NOT create TP
// - Does NOT create SL
//
// ENGINE RESPONSIBILITY:
//
// - Maintain cycle state on the server
// - Read REAL bot state from the bot object
// - Scan orderbook every 60 seconds
// - 10 successful scans per cycle
// - 6/10 bot-direction votes = cycle decision
// - Prepare complete display data for React
//
// REACT IS NOT THE SOURCE OF TRUTH.
//
// ============================================================

const OrderbookEntryModel =
  require("./orderbookEntryModel");

// ============================================================
// CONFIG
// ============================================================

const CYCLE_SIZE =
  10;

const SCAN_INTERVAL_MS =
  60 * 1000;

// ============================================================
// ENGINE STORAGE
// ============================================================
//
// botId -> engine state
//
// ============================================================

const engines =
  new Map();

// ============================================================
// ORDERBOOK MODEL
// ============================================================

const orderbookModel =
  new OrderbookEntryModel();

// ============================================================
// NORMALIZE DIRECTION
// ============================================================

function normalizeDirection(
  value
) {

  const direction =
    String(
      value || ""
    )
      .toUpperCase()
      .trim();

  if (
    direction ===
      "LONG" ||
    direction ===
      "SHORT"
  ) {

    return direction;
  }

  return null;
}

// ============================================================
// NORMALIZE TRIGGER STATE
// ============================================================

function normalizeTriggerState(
  value
) {

  return String(
    value ||
      "ARMED"
  )
    .toUpperCase()
    .trim();
}

// ============================================================
// MAJORITY DIRECTION
// ============================================================
//
// Used ONLY to summarize completed scans.
//
// The actual orderbook calculation happens inside:
//
// orderbookEntryModel.js
//
// ============================================================

function majorityDirection(
  values
) {

  let longCount =
    0;

  let shortCount =
    0;

  for (
    const value of
    values || []
  ) {

    const direction =
      normalizeDirection(
        value
      );

    if (
      direction ===
      "LONG"
    ) {

      longCount++;
    }

    if (
      direction ===
      "SHORT"
    ) {

      shortCount++;
    }
  }

  if (
    longCount ===
      0 &&
    shortCount ===
      0
  ) {

    return "NEUTRAL";
  }

  if (
    longCount >
    shortCount
  ) {

    return "LONG";
  }

  if (
    shortCount >
    longCount
  ) {

    return "SHORT";
  }

  return "NEUTRAL";
}

// ============================================================
// READ BOT INTO ENGINE
// ============================================================
//
// REAL BOT
//     ↓
// ENGINE
//
// React does NOT supply:
//
// - symbol
// - direction
// - trigger state
//
// ============================================================

function syncBotToEngine(
  engine,
  bot
) {

  if (
    !bot
  ) {

    throw new Error(
      "Bot is required"
    );
  }

  // ----------------------------------------------------------
  // BOT ID
  // ----------------------------------------------------------

  engine.botId =
    String(
      bot.id
    ).trim();

  // ----------------------------------------------------------
  // SYMBOL
  // ----------------------------------------------------------

  engine.symbol =
    String(
      bot.symbol || ""
    )
      .toUpperCase()
      .trim();

  // ----------------------------------------------------------
  // DIRECTION
  // ----------------------------------------------------------

  engine.botDirection =
    normalizeDirection(
      bot.direction
    );

  // ----------------------------------------------------------
  // TRIGGER STATE
  // ----------------------------------------------------------

  engine.triggerState =
    normalizeTriggerState(
      bot.triggerState
    );

  engine.updatedAt =
    Date.now();

  return engine;
}

// ============================================================
// CREATE ENGINE
// ============================================================

function createEngine(
  bot
) {

  return {

    // --------------------------------------------------------
    // BOT DATA
    // --------------------------------------------------------

    botId:
      String(
        bot.id
      ).trim(),

    symbol:
      String(
        bot.symbol || ""
      )
        .toUpperCase()
        .trim(),

    botDirection:
      normalizeDirection(
        bot.direction
      ),

    triggerState:
      normalizeTriggerState(
        bot.triggerState
      ),

    // --------------------------------------------------------
    // RUN STATE
    // --------------------------------------------------------

    running:
      false,

    scanInProgress:
      false,

    timer:
      null,

    // --------------------------------------------------------
    // CYCLE STATE
    // --------------------------------------------------------

    cycleNumber:
      0,

    cycleScans:
      [],

    previousCycles:
      [],

    // --------------------------------------------------------
    // ENGINE HISTORY
    // --------------------------------------------------------

    startedAt:
      null,

    lastScanAt:
      null,

    lastDecision:
      null,

    lastError:
      null,

    // --------------------------------------------------------
    // ENGINE METADATA
    // --------------------------------------------------------

    createdAt:
      Date.now(),

    updatedAt:
      Date.now(),
  };
}

// ============================================================
// ENSURE ENGINE
// ============================================================
//
// Existing cycle state is NEVER reset.
//
// Bot configuration is refreshed from the REAL bot.
//
// ============================================================

function ensureEngine(
  bot
) {

  const botId =
    String(
      bot?.id || ""
    ).trim();

  if (
    !botId
  ) {

    throw new Error(
      "Bot ID is required"
    );
  }

  let engine =
    engines.get(
      botId
    );

  // ----------------------------------------------------------
  // CREATE
  // ----------------------------------------------------------

  if (
    !engine
  ) {

    engine =
      createEngine(
        bot
      );

    engines.set(
      botId,
      engine
    );

    console.log(
      `[Entry Model Engine] CREATED | Bot=${botId} | ${engine.symbol} | ${engine.botDirection}`
    );

    return engine;
  }

  // ----------------------------------------------------------
  // REFRESH REAL BOT DATA
  //
  // DO NOT RESET CYCLE STATE.
  // ----------------------------------------------------------

  syncBotToEngine(
    engine,
    bot
  );

  return engine;
}

// ============================================================
// PREPARE SCAN FOR REACT
// ============================================================
//
// IMPORTANT:
//
// orderbookEntryModel already calculates:
//
// - depth direction
// - percentage
// - imbalance
// - ratios
// - filter result
// - 3/4 confirmation
// - final decision
//
// This function ONLY exposes the already-calculated
// depth information in a simple server response.
//
// React performs ZERO orderbook calculations.
//
// ============================================================

function prepareScanRecord(
  result,
  scanNumber
) {

  const depth15 =
    result?.depths?.find(
      (depth) =>
        depth?.depth ===
        15
    ) || null;

  const depth20 =
    result?.depths?.find(
      (depth) =>
        depth?.depth ===
        20
    ) || null;

  const depth30 =
    result?.depths?.find(
      (depth) =>
        depth?.depth ===
        30
    ) || null;

  const depth60 =
    result?.depths?.find(
      (depth) =>
        depth?.depth ===
        60
    ) || null;

  return {

    ...result,

    // --------------------------------------------------------
    // SERVER-PREPARED TREND
    // --------------------------------------------------------

    trend15:
      depth15?.direction ||
      "NEUTRAL",

    trend20:
      depth20?.direction ||
      "NEUTRAL",

    trend30:
      depth30?.direction ||
      "NEUTRAL",

    trend60:
      depth60?.direction ||
      "NEUTRAL",

    // --------------------------------------------------------
    // SERVER-PREPARED PERCENTAGE
    //
    // These values come directly from the orderbook model.
    //
    // React does NOT calculate them.
    // --------------------------------------------------------

    percentage15:
      depth15?.percentage ??
      null,

    percentage20:
      depth20?.percentage ??
      null,

    percentage30:
      depth30?.percentage ??
      null,

    percentage60:
      depth60?.percentage ??
      null,

    // --------------------------------------------------------
    // SCAN METADATA
    // --------------------------------------------------------

    scanNumber,

    scannedAt:
      Date.now(),
  };
}

// ============================================================
// COMPLETE CYCLE
// ============================================================
//
// 10 successful scans.
//
// 6 or more decisions matching the bot direction:
//
// LONG bot  -> LONG
// SHORT bot -> SHORT
//
// Otherwise:
//
// NEUTRAL
//
// ============================================================

function completeCycle(
  engine
) {

  if (
    engine.cycleScans.length <
    CYCLE_SIZE
  ) {

    return;
  }

  const scans =
    engine.cycleScans.slice(
      0,
      CYCLE_SIZE
    );

  // ----------------------------------------------------------
  // COUNT BOT-DIRECTION VOTES
  // ----------------------------------------------------------

  let botDirectionVotes =
    0;

  for (
    const scan of
    scans
  ) {

    if (
      scan?.decision ===
      engine.botDirection
    ) {

      botDirectionVotes++;
    }
  }

  // ----------------------------------------------------------
  // CYCLE DECISION
  // ----------------------------------------------------------

  const decision =
    botDirectionVotes >=
      6 &&
    engine.botDirection
      ? engine.botDirection
      : "NEUTRAL";

  // ----------------------------------------------------------
  // TREND SUMMARY
  //
  // Uses the server-prepared scan values.
  //
  // No orderbook calculation here.
  // ----------------------------------------------------------

  const trend15 =
    majorityDirection(
      scans.map(
        (scan) =>
          scan?.trend15
      )
    );

  const trend20 =
    majorityDirection(
      scans.map(
        (scan) =>
          scan?.trend20
      )
    );

  const trend30 =
    majorityDirection(
      scans.map(
        (scan) =>
          scan?.trend30
      )
    );

  const trend60 =
    majorityDirection(
      scans.map(
        (scan) =>
          scan?.trend60
      )
    );

  // ----------------------------------------------------------
  // PERCENTAGE SUMMARY
  //
  // Average of the already-calculated percentages.
  //
  // Null values are ignored.
  // ----------------------------------------------------------

  const percentage15 =
    averagePercentage(
      scans.map(
        (scan) =>
          scan?.percentage15
      )
    );

  const percentage20 =
    averagePercentage(
      scans.map(
        (scan) =>
          scan?.percentage20
      )
    );

  const percentage30 =
    averagePercentage(
      scans.map(
        (scan) =>
          scan?.percentage30
      )
    );

  const percentage60 =
    averagePercentage(
      scans.map(
        (scan) =>
          scan?.percentage60
      )
    );

  // ----------------------------------------------------------
  // NEXT CYCLE NUMBER
  // ----------------------------------------------------------

  engine.cycleNumber +=
    1;

  // ----------------------------------------------------------
  // COMPLETED CYCLE
  // ----------------------------------------------------------

  const completedCycle = {

    cycleNumber:
      engine.cycleNumber,

    botId:
      engine.botId,

    symbol:
      engine.symbol,

    botDirection:
      engine.botDirection,

    decision,

    botDirectionVotes,

    totalScans:
      scans.length,

    trend15,

    trend20,

    trend30,

    trend60,

    percentage15,

    percentage20,

    percentage30,

    percentage60,

    scans,

    completedAt:
      Date.now(),
  };

  // ----------------------------------------------------------
  // STORE HISTORY
  // ----------------------------------------------------------

  engine.previousCycles.push(
    completedCycle
  );

  // Keep memory bounded.
  if (
    engine.previousCycles.length >
    100
  ) {

    engine.previousCycles.shift();
  }

  // ----------------------------------------------------------
  // LAST DECISION
  // ----------------------------------------------------------

  engine.lastDecision =
    decision;

  // ----------------------------------------------------------
  // START NEXT CYCLE
  // ----------------------------------------------------------

  engine.cycleScans =
    [];

  engine.updatedAt =
    Date.now();

  console.log(
    `[Entry Model Engine] CYCLE COMPLETE | Bot=${engine.botId} | Cycle=${engine.cycleNumber} | Decision=${decision} | Votes=${botDirectionVotes}/${CYCLE_SIZE}`
  );
}

// ============================================================
// AVERAGE ALREADY-CALCULATED PERCENTAGES
// ============================================================

function averagePercentage(
  values
) {

  const validValues =
    (values || [])
      .filter(
        (value) =>
          Number.isFinite(
            Number(value)
          )
      )
      .map(
        (value) =>
          Number(value)
      );

  if (
    validValues.length ===
    0
  ) {

    return null;
  }

  const total =
    validValues.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    );

  return Number(
    (
      total /
      validValues.length
    ).toFixed(2)
  );
}

// ============================================================
// RUN ONE SCAN
// ============================================================
//
// REAL BOT
//   ↓
// syncBotToEngine()
//   ↓
// trigger check
//   ↓
// symbol + direction
//   ↓
// orderbook model
//   ↓
// server prepares display result
//   ↓
// cycle state
//   ↓
// React reads it
//
// ============================================================

async function runScan(
  engine,
  bot
) {

  console.log(
    `[Entry Model Engine] RUN SCAN ENTER | Bot=${engine.botId}`
  );

  // ----------------------------------------------------------
  // ENGINE RUNNING?
  // ----------------------------------------------------------

  if (
    !engine.running
  ) {

    console.log(
      `[Entry Model Engine] Scan skipped | Bot=${engine.botId} | Engine not running`
    );

    return;
  }

  // ----------------------------------------------------------
  // REFRESH REAL BOT
  // ----------------------------------------------------------

  try {

    syncBotToEngine(
      engine,
      bot
    );

  } catch (error) {

    engine.lastError =
      error?.message ||
      String(error);

    console.error(
      `[Entry Model Engine] Bot sync error | Bot=${engine.botId}`,
      error?.stack ||
        error
    );

    return;
  }

  // ----------------------------------------------------------
  // PREVENT OVERLAPPING SCANS
  // ----------------------------------------------------------

  if (
    engine.scanInProgress
  ) {

    console.log(
      `[Entry Model Engine] Scan skipped | Bot=${engine.botId} | Scan already running`
    );

    return;
  }

  // ----------------------------------------------------------
  // TRIGGER
  // ----------------------------------------------------------

  if (
    engine.triggerState !==
    "ARMED"
  ) {

    console.log(
      `[Entry Model Engine] Scan skipped | Bot=${engine.botId} | Trigger=${engine.triggerState}`
    );

    return;
  }

  // ----------------------------------------------------------
  // SYMBOL
  // ----------------------------------------------------------

  if (
    !engine.symbol
  ) {

    engine.lastError =
      "Missing symbol";

    console.error(
      `[Entry Model Engine] Scan error | Bot=${engine.botId} | Missing symbol`
    );

    return;
  }

  // ----------------------------------------------------------
  // BOT DIRECTION
  // ----------------------------------------------------------

  if (
    !engine.botDirection
  ) {

    engine.lastError =
      "Missing bot direction";

    console.error(
      `[Entry Model Engine] Scan error | Bot=${engine.botId} | Missing bot direction`
    );

    return;
  }

  // ----------------------------------------------------------
  // LOCK SCAN
  // ----------------------------------------------------------

  engine.scanInProgress =
    true;

  engine.lastError =
    null;

  engine.updatedAt =
    Date.now();

  try {

    console.log(
      `[Entry Model Engine] SCAN | Bot=${engine.botId} | ${engine.symbol} | Bot=${engine.botDirection} | ${engine.cycleScans.length + 1}/${CYCLE_SIZE}`
    );

    // --------------------------------------------------------
    // ORDERBOOK CALL
    // --------------------------------------------------------

    console.log(
      `[Entry Model Engine] ORDERBOOK CALL | Bot=${engine.botId} | Symbol=${engine.symbol} | Bot=${engine.botDirection}`
    );

    const result =
      await orderbookModel.scan(
        engine.symbol,
        engine.botDirection
      );

    console.log(
      `[Entry Model Engine] ORDERBOOK RETURNED | Bot=${engine.botId} | HasResult=${Boolean(result)}`
    );

    // --------------------------------------------------------
    // ONLY SUCCESSFUL SCANS COUNT
    // --------------------------------------------------------

    if (
      !result
    ) {

      console.log(
        `[Entry Model Engine] Empty scan result | Bot=${engine.botId}`
      );

      return;
    }

    // --------------------------------------------------------
    // PREPARE COMPLETE SERVER SCAN
    // --------------------------------------------------------

    const scanRecord =
      prepareScanRecord(
        result,
        engine.cycleScans.length +
          1
      );

    // --------------------------------------------------------
    // STORE SCAN
    // --------------------------------------------------------

    engine.cycleScans.push(
      scanRecord
    );

    engine.lastScanAt =
      Date.now();

    engine.updatedAt =
      Date.now();

    console.log(
      `[Entry Model Engine] SCAN COMPLETE | Bot=${engine.botId} | Count=${engine.cycleScans.length}/${CYCLE_SIZE} | Decision=${scanRecord.decision || "UNKNOWN"}`
    );

    console.log(
      `[Entry Model Engine] DEPTHS | Bot=${engine.botId} | 15=${scanRecord.trend15} ${scanRecord.percentage15 ?? "-"}% | 20=${scanRecord.trend20} ${scanRecord.percentage20 ?? "-"}% | 30=${scanRecord.trend30} ${scanRecord.percentage30 ?? "-"}% | 60=${scanRecord.trend60} ${scanRecord.percentage60 ?? "-"}%`
    );

    // --------------------------------------------------------
    // COMPLETE CYCLE AT 10
    // --------------------------------------------------------

    if (
      engine.cycleScans.length >=
      CYCLE_SIZE
    ) {

      completeCycle(
        engine
      );
    }

  } catch (error) {

    engine.lastError =
      error?.message ||
      String(error);

    engine.updatedAt =
      Date.now();

    console.error(
      `[Entry Model Engine] Scan error | Bot=${engine.botId}`,
      error?.stack ||
        error
    );

  } finally {

    engine.scanInProgress =
      false;

    engine.updatedAt =
      Date.now();

    console.log(
      `[Entry Model Engine] RUN SCAN EXIT | Bot=${engine.botId} | Count=${engine.cycleScans.length}/${CYCLE_SIZE}`
    );
  }
}

// ============================================================
// SCHEDULE NEXT SCAN
// ============================================================

function scheduleNextScan(
  engine,
  bot
) {

  if (
    !engine.running
  ) {

    return;
  }

  if (
    engine.timer
  ) {

    clearTimeout(
      engine.timer
    );
  }

  engine.timer =
    setTimeout(
      async () => {

        engine.timer =
          null;

        if (
          !engine.running
        ) {

          return;
        }

        await runScan(
          engine,
          bot
        );

        scheduleNextScan(
          engine,
          bot
        );

      },
      SCAN_INTERVAL_MS
    );
}

// ============================================================
// START ENGINE
// ============================================================

async function startEngine(
  bot
) {

  const engine =
    ensureEngine(
      bot
    );

  // ----------------------------------------------------------
  // SAFETY
  // ----------------------------------------------------------

  if (
    engine.triggerState !==
    "ARMED"
  ) {

    engine.running =
      false;

    return getStatus(
      engine.botId
    );
  }

  // ----------------------------------------------------------
  // ALREADY RUNNING
  // ----------------------------------------------------------

  if (
    engine.running
  ) {

    syncBotToEngine(
      engine,
      bot
    );

    return getStatus(
      engine.botId
    );
  }

  // ----------------------------------------------------------
  // START
  // ----------------------------------------------------------

  engine.running =
    true;

  engine.startedAt =
    Date.now();

  engine.lastError =
    null;

  engine.updatedAt =
    Date.now();

  console.log(
    `[Entry Model Engine] START | Bot=${engine.botId} | ${engine.symbol} | ${engine.botDirection}`
  );

  // ----------------------------------------------------------
  // FIRST SCAN IMMEDIATELY
  // ----------------------------------------------------------

  console.log(
    `[Entry Model Engine] START -> RUN SCAN | Bot=${engine.botId}`
  );

  await runScan(
    engine,
    bot
  );

  // ----------------------------------------------------------
  // NEXT SCAN IN 60 SECONDS
  // ----------------------------------------------------------

  scheduleNextScan(
    engine,
    bot
  );

  return getStatus(
    engine.botId
  );
}

// ============================================================
// UPDATE ENGINE BOT
// ============================================================
//
// Does NOT reset cycle.
//
// ============================================================

function updateEngineBot(
  bot
) {

  const engine =
    ensureEngine(
      bot
    );

  return getStatus(
    engine.botId
  );
}

// ============================================================
// STOP ENGINE
// ============================================================

function stopEngine(
  botId
) {

  const id =
    String(
      botId || ""
    ).trim();

  const engine =
    engines.get(
      id
    );

  if (
    !engine
  ) {

    return null;
  }

  engine.running =
    false;

  if (
    engine.timer
  ) {

    clearTimeout(
      engine.timer
    );

    engine.timer =
      null;
  }

  engine.updatedAt =
    Date.now();

  console.log(
    `[Entry Model Engine] STOP | Bot=${id}`
  );

  return getStatus(
    id
  );
}

// ============================================================
// GET STATUS
// ============================================================

function getStatus(
  botId
) {

  const id =
    String(
      botId || ""
    ).trim();

  const engine =
    engines.get(
      id
    );

  if (
    !engine
  ) {

    return null;
  }

  return {

    botId:
      engine.botId,

    symbol:
      engine.symbol,

    botDirection:
      engine.botDirection,

    triggerState:
      engine.triggerState,

    running:
      engine.running,

    cycleNumber:
      engine.cycleNumber,

    cycleSize:
      CYCLE_SIZE,

    scanCount:
      engine.cycleScans.length,

    currentScans:
      engine.cycleScans,

    previousCycles:
      engine.previousCycles,

    lastScanAt:
      engine.lastScanAt,

    startedAt:
      engine.startedAt,

    lastDecision:
      engine.lastDecision,

    lastError:
      engine.lastError,

    createdAt:
      engine.createdAt,

    updatedAt:
      engine.updatedAt,
  };
}

// ============================================================
// GET ALL STATUS
// ============================================================

function getAllStatus() {

  return Array.from(
    engines.values()
  ).map(
    (engine) =>
      getStatus(
        engine.botId
      )
  );
}

// ============================================================
// DELETE ENGINE
// ============================================================

function deleteEngine(
  botId
) {

  const id =
    String(
      botId || ""
    ).trim();

  const engine =
    engines.get(
      id
    );

  if (
    !engine
  ) {

    return false;
  }

  if (
    engine.timer
  ) {

    clearTimeout(
      engine.timer
    );

    engine.timer =
      null;
  }

  engine.running =
    false;

  engines.delete(
    id
  );

  console.log(
    `[Entry Model Engine] DELETE | Bot=${id}`
  );

  return true;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  startEngine,

  updateEngineBot,

  stopEngine,

  getStatus,

  getAllStatus,

  deleteEngine,

};