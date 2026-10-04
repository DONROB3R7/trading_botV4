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
//        10
//        15
//        25
//        35
//   3. Evaluates each depth
//   4. Requires 3 of 4 confirmations
//   5. Uses the BOT direction as the trend
//   6. Looks for STRONG ORDERBOOK DIRECTION
//
// LONG:
//   Looks for LONG strength.
//
// SHORT:
//   Looks for SHORT strength.
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
  10,
  15,
  25,
  35,
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
    // LONG STRENGTH
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
    // SHORT STRENGTH
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
    // LONG:
    //   BID / TOTAL
    //
    // SHORT:
    //   ASK / TOTAL
    //
    // NEUTRAL:
    //   null
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


    // ========================================================
    // SAME-DIRECTION CONFIRMATION
    // ========================================================
    //
    // LONG bot:
    //   We want LONG orderbook strength.
    //
    // SHORT bot:
    //   We want SHORT orderbook strength.
    //
    // NO PULLBACK.
    //
    // ========================================================

    const passedDepths =
      depths.filter(
        (result) =>
          result.direction ===
          direction
      );


    const confirmations =
      passedDepths.length;


    const directionConfirmed =
      confirmations >=
      REQUIRED_CONFIRMATIONS;


    // --------------------------------------------------------
    // ENTRY DECISION
    // --------------------------------------------------------

    const decision =
      directionConfirmed
        ? direction
        : "NEUTRAL";


    return {

      botDirection:
        direction,

      decision,

      directionConfirmed,

      confirmations,

      requiredConfirmations:
        REQUIRED_CONFIRMATIONS,

      totalDepths:
        CONFIRMATION_DEPTHS.length,

      confirmationDepths:
        CONFIRMATION_DEPTHS,

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
      `[Entry Model] ${normalizedSymbol} | Bot=${result.botDirection} | SameDirection=${result.botDirection} | Confirmations=${result.confirmations}/${result.totalDepths} | Decision=${result.decision}`
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

