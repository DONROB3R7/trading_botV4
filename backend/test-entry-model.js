const readline = require("readline");

const OrderbookEntryModel =
  require("./entry-models/orderbookEntryModel");

// ============================================================
// ENTRY MODEL TEST CONSOLE
// ============================================================

const model =
  new OrderbookEntryModel();

const rl =
  readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

// ============================================================
// HELPERS
// ============================================================

function ask(question) {
  return new Promise((resolve) => {
    rl.question(
      question,
      (answer) => {
        resolve(
          String(answer || "").trim()
        );
      }
    );
  });
}

function line() {
  console.log(
    "============================================================"
  );
}

// ============================================================
// PRINT RESULT
// ============================================================

function printResult(result) {
  line();

  console.log(
    "ENTRY MODEL RESULT"
  );

  line();

  console.log(
    `Symbol:              ${result.symbol ?? "—"}`
  );

  console.log(
    `Bot Direction:       ${result.botDirection ?? "—"}`
  );

  console.log(
    `Pullback Direction:  ${result.pullbackDirection ?? "—"}`
  );

  console.log(
    `Decision:            ${result.decision ?? "—"}`
  );

  console.log(
    `Confirmations:       ${result.confirmations ?? "—"}/${result.totalDepths ?? 4}`
  );

  console.log(
    `Required:            ${result.requiredConfirmations ?? 3}`
  );

  console.log(
    `Snapshot Depth:      ${result.snapshotDepth ?? 200}`
  );

  console.log(
    `Confirmation Depths: ${
      Array.isArray(
        result.confirmationDepths
      )
        ? result.confirmationDepths.join(
            ", "
          )
        : "15, 20, 30, 60"
    }`
  );

  if (result.timestamp) {
    console.log(
      `Scan Time:           ${result.timestamp}`
    );
  }

  line();

  // ==========================================================
  // DEPTH RESULTS
  // ==========================================================

  if (
    Array.isArray(result.depths) &&
    result.depths.length > 0
  ) {
    console.log(
      "DEPTH RESULTS"
    );

    line();

    for (
      const depthResult of
        result.depths
    ) {
      console.log(
        `Depth ${String(
          depthResult.depth
        ).padStart(2, " ")} | ` +
        `Direction=${String(
          depthResult.direction
        ).padEnd(7, " ")} | ` +
        `Percentage=${String(
          depthResult.percentage
        ).padStart(6, " ")}% | ` +
        `Imbalance=${String(
          depthResult.imbalance
        ).padStart(8, " ")} | ` +
        `Bid/Ask=${String(
          depthResult.bidAskRatio
        ).padStart(7, " ")} | ` +
        `Filter=${depthResult.filterPass ? "PASS" : "FAIL"}`
      );
    }

    line();
  }

  // ==========================================================
  // CONFIRMATION SUMMARY
  // ==========================================================

  console.log(
    "CONFIRMATION SUMMARY"
  );

  line();

  const depths =
    Array.isArray(result.depths)
      ? result.depths
      : [];

  for (const depth of depths) {
    const expected =
      result.pullbackDirection;

    const confirmed =
      depth.direction === expected;

    console.log(
      `${String(depth.depth).padStart(2, " ")} depth | ` +
      `Expected=${String(expected).padEnd(5, " ")} | ` +
      `Actual=${String(depth.direction).padEnd(5, " ")} | ` +
      `${confirmed ? "CONFIRMED" : "NOT CONFIRMED"}`
    );
  }

  line();

  // ==========================================================
  // FULL RESULT
  // ==========================================================

  console.log(
    "FULL MODEL RESULT"
  );

  line();

  console.dir(
    result,
    {
      depth: null,
      colors: false,
    }
  );

  line();
}

// ============================================================
// RUN SCAN
// ============================================================

async function runScan() {
  try {
    const symbol =
      await ask(
        "Symbol [POLUSDT]: "
      );

    const directionInput =
      await ask(
        "Bot Direction [LONG/SHORT] (LONG): "
      );

    const normalizedSymbol =
      symbol || "POLUSDT";

    const botDirection =
      (
        directionInput ||
        "LONG"
      ).toUpperCase();

    // --------------------------------------------------------
    // VALIDATE
    // --------------------------------------------------------

    if (
      botDirection !== "LONG" &&
      botDirection !== "SHORT"
    ) {
      console.log(
        "\nInvalid bot direction."
      );

      return;
    }

    console.log("");

    line();

    console.log(
      `Scanning ${normalizedSymbol} | Bot=${botDirection}`
    );

    console.log(
      "Fetching ONE 200-level orderbook..."
    );

    console.log(
      "Splitting locally into 15 / 20 / 30 / 60..."
    );

    line();

    // --------------------------------------------------------
    // SCAN
    // --------------------------------------------------------

    const result =
      await model.scan(
        normalizedSymbol,
        botDirection
      );

    // --------------------------------------------------------
    // PRINT
    // --------------------------------------------------------

    printResult(result);
  } catch (error) {
    console.error("");

    line();

    console.error(
      "ENTRY MODEL TEST ERROR"
    );

    line();

    console.error(
      error?.stack ||
        error?.message ||
        error
    );

    // --------------------------------------------------------
    // WEEX ERROR DATA
    // --------------------------------------------------------

    if (error?.data) {
      console.error("");

      console.error(
        "WEEX RESPONSE:"
      );

      console.dir(
        error.data,
        {
          depth: null,
          colors: false,
        }
      );
    }

    line();
  }
}

// ============================================================
// MENU
// ============================================================

async function main() {
  console.clear();

  line();

  console.log(
    "WEEX BOT LAB - ENTRY MODEL TEST CONSOLE"
  );

  line();

  console.log(
    "1. Test Orderbook Entry Model"
  );

  console.log(
    "2. Exit"
  );

  line();

  const choice =
    await ask(
      "Select: "
    );

  // ----------------------------------------------------------
  // TEST
  // ----------------------------------------------------------

  if (choice === "1") {
    await runScan();

    console.log("");

    await ask(
      "Press ENTER to return to menu..."
    );

    return main();
  }

  // ----------------------------------------------------------
  // EXIT
  // ----------------------------------------------------------

  if (choice === "2") {
    rl.close();

    return;
  }

  // ----------------------------------------------------------
  // INVALID
  // ----------------------------------------------------------

  console.log(
    "\nInvalid selection."
  );

  await ask(
    "Press ENTER to continue..."
  );

  return main();
}

// ============================================================
// START
// ============================================================

main().catch((error) => {
  console.error(
    "\nFatal test console error:"
  );

  console.error(
    error?.stack ||
      error
  );

  rl.close();
});

