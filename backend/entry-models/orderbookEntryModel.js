const WeexClient =
  require("../../execution/weexClient");

// ============================================================
// ORDERBOOK ENTRY MODEL
// ============================================================

const WEEX_REQUEST_DEPTH =
  200;

const CONFIRMATION_DEPTHS = [
  5,
  10,
  15,
  20,
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
  // FORMAT PRICE
  // ==========================================================

  formatPrice(
    price
  ) {

    if (
      !Number.isFinite(price)
    ) {
      return null;
    }

    return Number(
      price.toFixed(8)
    );
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
              level.price
            ) &&
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
              level.price
            ) &&
            Number.isFinite(
              level.quantity
            ) &&
            level.quantity > 0
        );


    // ========================================================
    // PRICE RANGE
    // ========================================================

    const bidBestPrice =
      bidLevels.length > 0
        ? bidLevels[0].price
        : null;

    const bidDeepestPrice =
      bidLevels.length > 0
        ? bidLevels[
            bidLevels.length - 1
          ].price
        : null;

    const askBestPrice =
      askLevels.length > 0
        ? askLevels[0].price
        : null;

    const askDeepestPrice =
      askLevels.length > 0
        ? askLevels[
            askLevels.length - 1
          ].price
        : null;


    const lowestPrice =
      [
        bidDeepestPrice,
        askDeepestPrice,
      ]
        .filter(
          (price) =>
            Number.isFinite(price)
        )
        .reduce(
          (lowest, price) =>
            Math.min(
              lowest,
              price
            ),
          Infinity
        );

    const highestPrice =
      [
        bidBestPrice,
        askBestPrice,
      ]
        .filter(
          (price) =>
            Number.isFinite(price)
        )
        .reduce(
          (highest, price) =>
            Math.max(
              highest,
              price
            ),
          -Infinity
        );


    const priceRange =
      Number.isFinite(
        lowestPrice
      ) &&
      Number.isFinite(
        highestPrice
      )
        ? {
            low:
              this.formatPrice(
                lowestPrice
              ),

            high:
              this.formatPrice(
                highestPrice
              ),
          }
        : null;


    const bidPriceRange =
      Number.isFinite(
        bidBestPrice
      ) &&
      Number.isFinite(
        bidDeepestPrice
      )
        ? {
            best:
              this.formatPrice(
                bidBestPrice
              ),

            deepest:
              this.formatPrice(
                bidDeepestPrice
              ),
          }
        : null;


    const askPriceRange =
      Number.isFinite(
        askBestPrice
      ) &&
      Number.isFinite(
        askDeepestPrice
      )
        ? {
            best:
              this.formatPrice(
                askBestPrice
              ),

            deepest:
              this.formatPrice(
                askDeepestPrice
              ),
          }
        : null;


    // ========================================================
    // NOT ENOUGH LEVELS
    // ========================================================

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

        bidPriceRange,

        askPriceRange,

        priceRange,
      };
    }


    // ========================================================
    // LIQUIDITY
    // ========================================================

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

        bidPriceRange,

        askPriceRange,

        priceRange,
      };
    }


    // ========================================================
    // IMBALANCE
    // ========================================================

    const imbalance =
      (
        bidLiquidity -
        askLiquidity
      ) /
      totalLiquidity;


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


    // ========================================================
    // LONG
    // ========================================================

    const longImbalancePass =
      imbalance >=
      LONG_MIN_IMBALANCE;

    const longRatioPass =
      bidAskRatio >=
      MIN_BID_ASK_RATIO;

    const longPass =
      longImbalancePass &&
      longRatioPass;


    // ========================================================
    // SHORT
    // ========================================================

    const shortImbalancePass =
      imbalance <=
      SHORT_MAX_IMBALANCE;

    const shortRatioPass =
      askBidRatio >=
      MIN_ASK_BID_RATIO;

    const shortPass =
      shortImbalancePass &&
      shortRatioPass;


    // ========================================================
    // DIRECTION
    // ========================================================

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


    // ========================================================
    // RESULT
    // ========================================================

    return {

      depth,

      direction,

      percentage:
        percentage === null
          ? null
          : Number(
              percentage.toFixed(
                2
              )
            ),

      bidLiquidity,

      askLiquidity,

      totalLiquidity,

      imbalance:
        Number(
          imbalance.toFixed(
            6
          )
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

      // ======================================================
      // NEW PRICE RANGE DATA
      // ======================================================

      bidPriceRange,

      askPriceRange,

      priceRange,
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


    const depths =
      CONFIRMATION_DEPTHS.map(
        (depth) =>
          this.calculateDepth(
            bids,
            asks,
            depth
          )
      );


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


    const result =
      this.analyzeSnapshot(
        response,
        botDirection
      );


    console.log(
      `[Entry Model] ${normalizedSymbol} | Bot=${result.botDirection} | Confirmations=${result.confirmations}/${result.totalDepths} | Decision=${result.decision}`
    );


    return {

      symbol:
        normalizedSymbol,

      ...result,
    };
  }
}


module.exports =
  OrderbookEntryModel;