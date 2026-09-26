const PositionService =
  require("../execution/positions");

// ============================================================
// TEST WEEX POSITION
// ============================================================

async function main() {

  console.log(
    "=========================================="
  );

  console.log(
    "WEEX POSITION TEST"
  );

  console.log(
    "=========================================="
  );

  try {

    const positions =
      new PositionService();

    console.log(
      "[TEST] Looking for POLUSDT position..."
    );

    const result =
      await positions.getPosition(
        "POLUSDT"
      );

    console.log(
      "[TEST] RAW RESULT:"
    );

    console.dir(
      result,
      {
        depth: null,
        colors: false,
      }
    );

    console.log(
      "=========================================="
    );

    console.log(
      "[TEST] Done."
    );

    console.log(
      "=========================================="
    );

  } catch (error) {

    console.error(
      "[TEST] ERROR:"
    );

    console.error(
      error
    );

  }

}

main();