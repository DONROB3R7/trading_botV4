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
// Engine responsibility:
// - Maintain cycle state on the server
// - Scan orderbook every 60 seconds
// - 10 successful scans per cycle
// - 6/10 bot-direction votes = cycle decision
//
// ============================================================

const OrderbookEntryModel =
  require("./orderbookEntryModel");

// ============================================================
// CONFIG
// ============================================================

const CYCLE_SIZE = 10;

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
    direction === "LONG" ||
    direction === "SHORT"
  ) {
    return direction;
  }

  return null;
}

// ============================================================
// MAJORITY DIRECTION
// ============================================================

function majorityDirection(
  values
) {
  let longCount = 0;
  let shortCount = 0;

  for (
    const value of
    values || []
  ) {
    const direction =
      normalizeDirection(
        value
      );

    if (
      direction === "LONG"
    ) {
      longCount++;
    }

    if (
      direction === "SHORT"
    ) {
      shortCount++;
    }
  }

  if (
    longCount === 0 &&
    shortCount === 0
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
// CREATE ENGINE
// ============================================================

function createEngine(
  bot
) {
  return {
    botId:
      String(
        bot.id
      ),

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
      String(
        bot.triggerState ||
          "ARMED"
      )
        .toUpperCase()
        .trim(),

    running:
      false,

    cycleNumber:
      0,

    cycleScans:
      [],

    previousCycles:
      [],

    timer:
      null,

    scanInProgress:
      false,

    startedAt:
      null,

    lastScanAt:
      null,

    lastDecision:
      null,

    lastError:
      null,

    createdAt:
      Date.now(),

    updatedAt:
      Date.now(),
  };
}

// ============================================================
// ENSURE ENGINE
// ============================================================

function ensureEngine(
  bot
) {
  const botId =
    String(
      bot.id
    ).trim();

  let engine =
    engines.get(
      botId
    );

  if (!engine) {
    engine =
      createEngine(
        bot
      );

    engines.set(
      botId,
      engine
    );

    return engine;
  }

  // ----------------------------------------------------------
  // UPDATE EXISTING ENGINE
  //
  // IMPORTANT:
  // Do NOT reset cycle state.
  // ----------------------------------------------------------

  if (
    bot.symbol !==
    undefined
  ) {
    engine.symbol =
      String(
        bot.symbol || ""
      )
        .toUpperCase()
        .trim();
  }

  if (
    bot.direction !==
    undefined
  ) {
    const direction =
      normalizeDirection(
        bot.direction
      );

    if (direction) {
      engine.botDirection =
        direction;
    }
  }

  if (
    bot.triggerState !==
    undefined
  ) {
    engine.triggerState =
      String(
        bot.triggerState ||
          "UNKNOWN"
      )
        .toUpperCase()
        .trim();
  }

  engine.updatedAt =
    Date.now();

  return engine;
}

// ============================================================
// COMPLETE CYCLE
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
    botDirectionVotes >= 6
      ? engine.botDirection
      : "NEUTRAL";

  // ----------------------------------------------------------
  // TREND BY CONFIRMATION DEPTH
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
  // STORE COMPLETED CYCLE
  // ----------------------------------------------------------

  engine.cycleNumber += 1;

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

    scans,

    completedAt:
      Date.now(),
  };

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

  engine.lastDecision =
    decision;

  // ----------------------------------------------------------
  // RESET CURRENT CYCLE
  // ----------------------------------------------------------

  engine.cycleScans =
    [];

  console.log(
    `[Entry Model Engine] CYCLE COMPLETE | Bot=${engine.botId} | Cycle=${engine.cycleNumber} | Decision=${decision} | Votes=${botDirectionVotes}/${CYCLE_SIZE}`
  );
}

// ============================================================
// RUN ONE SCAN
// ============================================================

async function runScan(
  engine
) {
  // ----------------------------------------------------------
  // DEBUG:
  // Prove that startEngine() actually reaches runScan().
  // ----------------------------------------------------------

  console.log(
    `[Entry Model Engine] RUN SCAN ENTER | Bot=${engine.botId} | ${engine.symbol} | Running=${engine.running} | Scan=${engine.cycleScans.length + 1}/${CYCLE_SIZE}`
  );

  // ----------------------------------------------------------
  // SAFETY CHECKS
  // ----------------------------------------------------------

  if (
    !engine.running
  ) {
    console.log(
      `[Entry Model Engine] Scan skipped | Bot=${engine.botId} | Engine not running`
    );

    return;
  }

  if (
    engine.scanInProgress
  ) {
    console.log(
      `[Entry Model Engine] Scan skipped | Bot=${engine.botId} | Scan already running`
    );

    return;
  }

  if (
    engine.triggerState !==
    "ARMED"
  ) {
    console.log(
      `[Entry Model Engine] Scan skipped | Bot=${engine.botId} | Trigger=${engine.triggerState}`
    );

    return;
  }

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

  engine.scanInProgress =
    true;

  engine.lastError =
    null;

  try {
    console.log(
      `[Entry Model Engine] SCAN | Bot=${engine.botId} | ${engine.symbol} | Bot=${engine.botDirection} | ${engine.cycleScans.length + 1}/${CYCLE_SIZE}`
    );

    console.log(
      `[Entry Model Engine] ORDERBOOK CALL | Bot=${engine.botId} | Symbol=${engine.symbol}`
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
    // ONLY COUNT SUCCESSFUL SCANS
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
    // NORMALIZE SCAN RESULT
    // --------------------------------------------------------

    const scanRecord = {
      ...result,

      scanNumber:
        engine.cycleScans.length +
        1,

      scannedAt:
        Date.now(),
    };

    engine.cycleScans.push(
      scanRecord
    );

    engine.lastScanAt =
      Date.now();

    console.log(
      `[Entry Model Engine] SCAN COMPLETE | Bot=${engine.botId} | Count=${engine.cycleScans.length}/${CYCLE_SIZE} | Decision=${scanRecord.decision || "UNKNOWN"}`
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
  engine
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
          engine
        );

        scheduleNextScan(
          engine
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
    engine
  );

  // ----------------------------------------------------------
  // NEXT SCAN IN 60 SECONDS
  // ----------------------------------------------------------

  scheduleNextScan(
    engine
  );

  return getStatus(
    engine.botId
  );
}

// ============================================================
// UPDATE ENGINE BOT
// ============================================================

function updateEngineBot(
  bot
) {
  const engine =
    ensureEngine(
      bot
    );

  // ----------------------------------------------------------
  // IMPORTANT:
  // This function does NOT reset the cycle.
  // ----------------------------------------------------------

  if (
    engine.triggerState !==
    "ARMED"
  ) {
    // The router normally calls stopEngine() after this.
    // We intentionally don't destroy cycle history here.
  }

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

