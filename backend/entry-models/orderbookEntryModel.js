const WeexClient =
  require("../../execution/weexClient");

// ============================================================
// ORDERBOOK ENTRY MODEL
// ============================================================
//
// PURPOSE:
//
// Standalone Entry Model for testing.
//
// The model:
//   1. Fetches ONE 200-level WEEX orderbook snapshot
//   2. Splits that SAME snapshot into:
//        15
//        20
//        30
//        60
//   3. Evaluates each depth
//   4. Requires 3 of 4 confirmations
//   5. Uses the BOT direction as the trend
//   6. Looks for the OPPOSITE direction as a pullback
//
// IMPORTANT:
//
// This file DOES NOT:
//   - open trades
//   - close trades
//   - manage TP
//   - manage SL
//   - manage triggers
//
// ============================================================


// ============================================================
// CONFIG
// ============================================================

const WEEX_REQUEST_DEPTH =
  200;

const CONFIRMATION_DEPTHS = [
  15,
  20,
  30,
  60,
];

const REQUIRED_CONFIRMATIONS =
  3;


// ============================================================
// ORDERBOOK THRESHOLDS
// ============================================================

const LONG_MIN_IMBALANCE =
  0.005;

const SHORT_MAX_IMBALANCE =
  -0.005;

const MIN_BID_ASK_RATIO =
  0.90;

const MIN_ASK_BID_RATIO =
  0.90;


// ============================================================
// ENTRY MODEL
// ============================================================

class OrderbookEntryModel {

  constructor(client = null) {

    this.client =
      client ||
      new WeexClient();
  }


  // ==========================================================
  // NORMALIZE ORDERBOOK
  // ==========================================================

  normalizeOrderBook(
    response
  ) {

    const root =
      response?.data ??
      response;

    // --------------------------------------------------------
    // Try common WEEX response shapes.
    // --------------------------------------------------------

    let book =
      root?.data ??
      root;

    if (
      book?.data &&
      typeof book.data ===
        "object"
    ) {
      book =
        book.data;
    }

    const bids =
      Array.isArray(
        book?.bids
      )
        ? book.bids
        : [];

    const asks =
      Array.isArray(
        book?.asks
      )
        ? book.asks
        : [];

    return {
      bids,
      asks,
    };
  }


  // ==========================================================
  // NORMALIZE LEVEL
  // ==========================================================

  normalizeLevel(
    level
  ) {

    if (
      Array.isArray(level)
    ) {

      return {
        price:
          Number(level[0]),

        quantity:
          Number(level[1]),
      };
    }

    if (
      level &&
      typeof level ===
        "object"
    ) {

      return {
        price:
          Number(
            level.price ??
            level.p ??
            level[0]
          ),

        quantity:
          Number(
            level.quantity ??
            level.qty ??
            level.amount ??
            level.q ??
            level[1]
          ),
      };
    }

    return {
      price: 0,
      quantity: 0,
    };
  }


  // ==========================================================
  // CALCULATE DEPTH
  // ==========================================================

  calculateDepth(
    bids,
    asks,
    depth
  ) {

    const bidLevels =
      bids
        .slice(0, depth)
        .map(
          (level) =>
            this.normalizeLevel(
              level
            )
        )
        .filter(
          (level) =>
            Number.isFinite(
              level.quantity
            ) &&
            level.quantity > 0
        );

    const askLevels =
      asks
        .slice(0, depth)
        .map(
          (level) =>
            this.normalizeLevel(
              level
            )
        )
        .filter(
          (level) =>
            Number.isFinite(
              level.quantity
            ) &&
            level.quantity > 0
        );


    // --------------------------------------------------------
    // Not enough levels
    // --------------------------------------------------------

    if (
      bidLevels.length <
        depth ||
      askLevels.length <
        depth
    ) {

      return {
        depth,

        direction:
          "NEUTRAL",

        percentage:
          null,

        bidLiquidity:
          0,

        askLiquidity:
          0,

        totalLiquidity:
          0,

        imbalance:
          0,

        bidAskRatio:
          0,

        askBidRatio:
          0,

        imbalancePass:
          false,

        ratioPass:
          false,

        filterPass:
          false,

        enoughLevels:
          false,
      };
    }


    // --------------------------------------------------------
    // Liquidity
    // --------------------------------------------------------

    const bidLiquidity =
      bidLevels.reduce(
        (
          total,
          level
        ) =>
          total +
          level.quantity,
        0
      );

    const askLiquidity =
      askLevels.reduce(
        (
          total,
          level
        ) =>
          total +
          level.quantity,
        0
      );

    const totalLiquidity =
      bidLiquidity +
      askLiquidity;


    // --------------------------------------------------------
    // No liquidity
    // --------------------------------------------------------

    if (
      totalLiquidity <= 0
    ) {

      return {
        depth,

        direction:
          "NEUTRAL",

        percentage:
          null,

        bidLiquidity,

        askLiquidity,

        totalLiquidity,

        imbalance:
          0,

        bidAskRatio:
          0,

        askBidRatio:
          0,

        imbalancePass:
          false,

        ratioPass:
          false,

        filterPass:
          false,

        enoughLevels:
          true,
      };
    }


    // --------------------------------------------------------
    // Imbalance
    // --------------------------------------------------------

    const imbalance =
      (
        bidLiquidity -
        askLiquidity
      ) /
      totalLiquidity;


    // --------------------------------------------------------
    // Ratios
    // --------------------------------------------------------

    const bidAskRatio =
      askLiquidity > 0
        ? bidLiquidity /
          askLiquidity
        : Infinity;

    const askBidRatio =
      bidLiquidity > 0
        ? askLiquidity /
          bidLiquidity
        : Infinity;


    // --------------------------------------------------------
    // LONG
    // --------------------------------------------------------

    const longImbalancePass =
      imbalance >=
      LONG_MIN_IMBALANCE;

    const longRatioPass =
      bidAskRatio >=
      MIN_BID_ASK_RATIO;

    const longPass =
      longImbalancePass &&
      longRatioPass;


    // --------------------------------------------------------
    // SHORT
    // --------------------------------------------------------

    const shortImbalancePass =
      imbalance <=
      SHORT_MAX_IMBALANCE;

    const shortRatioPass =
      askBidRatio >=
      MIN_ASK_BID_RATIO;

    const shortPass =
      shortImbalancePass &&
      shortRatioPass;


    // --------------------------------------------------------
    // Direction
    // --------------------------------------------------------

    let direction =
      "NEUTRAL";

    if (
      longPass &&
      !shortPass
    ) {

      direction =
        "LONG";

    } else if (
      shortPass &&
      !longPass
    ) {

      direction =
        "SHORT";
    }


    // ========================================================
    // PERCENTAGE
    // ========================================================
    //
    // IMPORTANT:
    //
    // This is NOT a separate signal calculation.
    //
    // It simply reports the liquidity split of the
    // direction that actually passed the filter.
    //
    // LONG:
    //   BID / TOTAL
    //
    // SHORT:
    //   ASK / TOTAL
    //
    // NEUTRAL:
    //   null
    //
    // We NEVER show a fake 50%.
    //
    // ========================================================

    let percentage =
      null;

    if (
      direction ===
      "LONG"
    ) {

      percentage =
        (
          bidLiquidity /
          totalLiquidity
        ) *
        100;

    } else if (
      direction ===
      "SHORT"
    ) {

      percentage =
        (
          askLiquidity /
          totalLiquidity
        ) *
        100;
    }


    // --------------------------------------------------------
    // Return depth result
    // --------------------------------------------------------

    return {

      depth,

      direction,

      percentage:
        percentage === null
          ? null
          : Number(
              percentage.toFixed(2)
            ),

      bidLiquidity,

      askLiquidity,

      totalLiquidity,

      imbalance:
        Number(
          imbalance.toFixed(6)
        ),

      bidAskRatio:
        Number.isFinite(
          bidAskRatio
        )
          ? Number(
              bidAskRatio.toFixed(
                4
              )
            )
          : bidAskRatio,

      askBidRatio:
        Number.isFinite(
          askBidRatio
        )
          ? Number(
              askBidRatio.toFixed(
                4
              )
            )
          : askBidRatio,

      imbalancePass:
        longPass ||
        shortPass,

      ratioPass:
        longPass ||
        shortPass,

      filterPass:
        longPass ||
        shortPass,

      enoughLevels:
        true,
    };
  }


  // ==========================================================
  // ANALYZE ONE 200-LEVEL SNAPSHOT
  // ==========================================================

  analyzeSnapshot(
    snapshot,
    botDirection
  ) {

    const direction =
      String(
        botDirection
      )
        .toUpperCase()
        .trim();

    if (
      direction !==
        "LONG" &&
      direction !==
        "SHORT"
    ) {

      throw new Error(
        "Bot direction must be LONG or SHORT"
      );
    }


    const {
      bids,
      asks,
    } =
      this.normalizeOrderBook(
        snapshot
      );


    // --------------------------------------------------------
    // SAME SNAPSHOT
    //
    // IMPORTANT:
    //
    // We do NOT request WEEX again.
    //
    // All four depths use these same arrays.
    // --------------------------------------------------------

    const depths =
      CONFIRMATION_DEPTHS.map(
        (depth) =>
          this.calculateDepth(
            bids,
            asks,
            depth
          )
      );


    // --------------------------------------------------------
    // Opposite direction = pullback
    // --------------------------------------------------------

    const pullbackDirection =
      direction ===
      "LONG"
        ? "SHORT"
        : "LONG";


    const passedDepths =
      depths.filter(
        (result) =>
          result.direction ===
          pullbackDirection
      );


    const confirmations =
      passedDepths.length;


    const pullbackConfirmed =
      confirmations >=
      REQUIRED_CONFIRMATIONS;


    // --------------------------------------------------------
    // ENTRY DECISION
    // --------------------------------------------------------

    const decision =
      pullbackConfirmed
        ? direction
        : "NEUTRAL";


    return {

      botDirection:
        direction,

      pullbackDirection,

      decision,

      pullbackConfirmed,

      confirmations,

      requiredConfirmations:
        REQUIRED_CONFIRMATIONS,

      totalDepths:
        CONFIRMATION_DEPTHS.length,

      depths,

      timestamp:
        Date.now(),
    };
  }


  // ==========================================================
  // FETCH + ANALYZE
  // ==========================================================

  async scan(
    symbol,
    botDirection
  ) {

    const normalizedSymbol =
      String(symbol)
        .toUpperCase()
        .trim();

    if (
      !normalizedSymbol
    ) {

      throw new Error(
        "Entry Model symbol is required"
      );
    }


    // --------------------------------------------------------
    // ONE WEEX REQUEST
    // --------------------------------------------------------

    console.log(
      `[Entry Model] Orderbook scan | ${normalizedSymbol} | depth=${WEEX_REQUEST_DEPTH}`
    );


    const response =
      await this.client.get(
        "/capi/v3/market/depth",
        {
          symbol:
            normalizedSymbol,

          limit:
            WEEX_REQUEST_DEPTH,
        },
        false
      );


    // --------------------------------------------------------
    // Analyze SAME snapshot
    // --------------------------------------------------------

    const result =
      this.analyzeSnapshot(
        response,
        botDirection
      );


    console.log(
      `[Entry Model] ${normalizedSymbol} | Bot=${result.botDirection} | Pullback=${result.pullbackDirection} | Confirmations=${result.confirmations}/${result.totalDepths} | Decision=${result.decision}`
    );


    return {
      symbol:
        normalizedSymbol,

      ...result,
    };
  }
}


// ============================================================
// EXPORT
// ============================================================

module.exports =
  OrderbookEntryModel;