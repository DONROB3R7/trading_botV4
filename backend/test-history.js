const WeexClient = require("../execution/weexClient");

// ============================================================
// TEST WEEX ALGO HISTORY
// ============================================================

async function main() {

  console.log("==========================================");
  console.log("WEEX ALGO HISTORY TEST");
  console.log("==========================================");

  try {

    const client =
      new WeexClient();

    console.log(
      "[TEST] Looking for POLUSDT algo history..."
    );

    const result =
      await client.get(
        "/capi/v3/allAlgoOrders",
        {
          symbol: "POLUSDT",
          page: 1,
          limit: 100,
        }
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