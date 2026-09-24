const WeexClient = require("./weexClient");

class OrderService {
  constructor(client = null) {
    this.client =
      client ||
      new WeexClient();

    // ==========================================================
    // DEFAULT TEST SETTINGS
    // ==========================================================

    this.defaultLeverage = "10";
    this.defaultMarginType = "ISOLATED";

    // Current test size.
    // POLUSDT = 10 contracts.
    this.defaultQuantity = "10";
  }

  // ==========================================================
  // SET LEVERAGE
  // ==========================================================

  async setLeverage(symbol) {
    const normalizedSymbol =
      String(symbol)
        .toUpperCase()
        .trim();

    console.log(
      `[TEST] Setting ${normalizedSymbol} isolated 10x...`
    );

    return this.client.post(
      "/capi/v3/account/leverage",
      {
        symbol:
          normalizedSymbol,

        marginType:
          this.defaultMarginType,

        isolatedLongLeverage:
          this.defaultLeverage,

        isolatedShortLeverage:
          this.defaultLeverage,
      }
    );
  }

  // ==========================================================
  // OPEN POSITION
  // ==========================================================

  async openTestPosition(
    symbol,
    direction
  ) {
    const normalizedSymbol =
      String(symbol)
        .toUpperCase()
        .trim();

    const normalizedDirection =
      String(direction)
        .toUpperCase()
        .trim();

    if (
      normalizedDirection !==
        "LONG" &&
      normalizedDirection !==
        "SHORT"
    ) {
      throw new Error(
        "Direction must be LONG or SHORT"
      );
    }

    // ----------------------------------------------------------
    // Set isolated 10x
    // ----------------------------------------------------------

    await this.setLeverage(
      normalizedSymbol
    );

    // ----------------------------------------------------------
    // LONG = BUY / LONG
    // SHORT = SELL / SHORT
    // ----------------------------------------------------------

    const side =
      normalizedDirection ===
      "LONG"
        ? "BUY"
        : "SELL";

    const positionSide =
      normalizedDirection;

    const clientOrderId =
      `bot_${normalizedSymbol.toLowerCase()}_${Date.now()}`;

    const body = {
      symbol:
        normalizedSymbol,

      side,

      positionSide,

      type:
        "MARKET",

      quantity:
        this.defaultQuantity,

      newClientOrderId:
        clientOrderId,
    };

    console.log(
      "[TEST] MARKET ORDER BODY"
    );

    console.log(
      JSON.stringify(
        body,
        null,
        2
      )
    );

    const result =
      await this.client.post(
        "/capi/v3/order",
        body
      );

    console.log(
      "[TEST] MARKET ORDER RESPONSE"
    );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return {
      ...result,
      symbol:
        normalizedSymbol,
      direction:
        normalizedDirection,
      side,
      positionSide,
      quantity:
        this.defaultQuantity,
    };
  }

  // ==========================================================
  // CLOSE POSITION
  // ==========================================================

  async closeTestPosition(
    symbol
  ) {
    const normalizedSymbol =
      String(symbol)
        .toUpperCase()
        .trim();

    console.log(
      `[TEST] Looking for ${normalizedSymbol} position...`
    );

    const result =
      await this.client.get(
        "/capi/v3/account/position/allPosition"
      );

    const positions =
      Array.isArray(
        result?.data
      )
        ? result.data
        : [];

    const position =
      positions.find(
        (item) =>
          String(
            item.symbol || ""
          ).toUpperCase() ===
            normalizedSymbol &&
          Number(
            item.size || 0
          ) !== 0
      );

    if (!position) {
      throw new Error(
        `No open ${normalizedSymbol} position found`
      );
    }

    const positionSide =
      String(
        position.side || ""
      ).toUpperCase();

    const quantity =
      String(
        Math.abs(
          Number(
            position.size
          )
        )
      );

    if (
      positionSide !==
        "LONG" &&
      positionSide !==
        "SHORT"
    ) {
      throw new Error(
        `Unknown position side: ${position.side}`
      );
    }

    // LONG position closes with SELL.
    // SHORT position closes with BUY.
    const side =
      positionSide ===
      "LONG"
        ? "SELL"
        : "BUY";

    const body = {
      symbol:
        normalizedSymbol,

      side,

      positionSide,

      type:
        "MARKET",

      quantity,

      reduceOnly:
        true,

      newClientOrderId:
        `bot_close_${normalizedSymbol.toLowerCase()}_${Date.now()}`,
    };

    console.log(
      "[TEST] CLOSE ORDER BODY"
    );

    console.log(
      JSON.stringify(
        body,
        null,
        2
      )
    );

    const closeResult =
      await this.client.post(
        "/capi/v3/order",
        body
      );

    console.log(
      "[TEST] CLOSE ORDER RESPONSE"
    );

    console.log(
      JSON.stringify(
        closeResult,
        null,
        2
      )
    );

    return {
      ...closeResult,

      symbol:
        normalizedSymbol,

      direction:
        positionSide,

      quantity,
    };
  }

  // ==========================================================
  // CREATE TP + SL
  // ==========================================================

  async updateTestTpSl(
    symbol,
    slPercent,
    tpPercent
  ) {
    const normalizedSymbol =
      String(symbol)
        .toUpperCase()
        .trim();

    const sl =
      Number(slPercent);

    const tp =
      Number(tpPercent);

    if (
      !Number.isFinite(sl) ||
      sl <= 0
    ) {
      throw new Error(
        "Stop Loss must be greater than 0"
      );
    }

    if (
      !Number.isFinite(tp) ||
      tp <= 0
    ) {
      throw new Error(
        "Take Profit must be greater than 0"
      );
    }

    // ----------------------------------------------------------
    // Get current position
    // ----------------------------------------------------------

    const result =
      await this.client.get(
        "/capi/v3/account/position/allPosition"
      );

    const positions =
      Array.isArray(
        result?.data
      )
        ? result.data
        : [];

    const position =
      positions.find(
        (item) =>
          String(
            item.symbol || ""
          ).toUpperCase() ===
            normalizedSymbol &&
          Number(
            item.size || 0
          ) !== 0
      );

    if (!position) {
      throw new Error(
        `No open ${normalizedSymbol} position found`
      );
    }

    const positionSide =
      String(
        position.side || ""
      ).toUpperCase();

    const size =
      Math.abs(
        Number(
          position.size
        )
      );

    const openValue =
      Number(
        position.openValue ||
          position.openValueAmount ||
          0
      );

    let averageEntry =
      Number(
        position.averageEntryPrice ||
        position.avgOpenPrice ||
        position.entryPrice ||
        0
      );

    // ----------------------------------------------------------
    // Fallback calculation used by our previous working test.
    // ----------------------------------------------------------

    if (
      !Number.isFinite(
        averageEntry
      ) ||
      averageEntry <= 0
    ) {
      if (
        openValue > 0 &&
        size > 0
      ) {
        averageEntry =
          openValue / size;
      }
    }

    if (
      !Number.isFinite(
        averageEntry
      ) ||
      averageEntry <= 0
    ) {
      throw new Error(
        `Could not determine entry price for ${normalizedSymbol}`
      );
    }

    // ----------------------------------------------------------
    // Calculate prices
    // ----------------------------------------------------------

    let stopLoss;
    let takeProfit;

    if (
      positionSide ===
      "LONG"
    ) {
      stopLoss =
        averageEntry *
        (1 - sl / 100);

      takeProfit =
        averageEntry *
        (1 + tp / 100);
    } else if (
      positionSide ===
      "SHORT"
    ) {
      stopLoss =
        averageEntry *
        (1 + sl / 100);

      takeProfit =
        averageEntry *
        (1 - tp / 100);
    } else {
      throw new Error(
        `Unknown position side: ${position.side}`
      );
    }

    // ----------------------------------------------------------
    // WEEX price precision for our current test symbols.
    // ----------------------------------------------------------

    stopLoss =
      Number(
        stopLoss.toFixed(5)
      );

    takeProfit =
      Number(
        takeProfit.toFixed(5)
      );

    console.log(
      `[TEST] ${normalizedSymbol} ${positionSide}`
    );

    console.log(
      `[TEST] Entry=${averageEntry}`
    );

    console.log(
      `[TEST] SL=${stopLoss}`
    );

    console.log(
      `[TEST] TP=${takeProfit}`
    );

    // ----------------------------------------------------------
    // STOP LOSS
    // ----------------------------------------------------------

    const slBody = {
      symbol:
        normalizedSymbol,

      clientAlgoId:
        `bot_sl_${normalizedSymbol.toLowerCase()}_${Date.now()}`,

      planType:
        "STOP_LOSS",

      triggerPrice:
        String(stopLoss),

      executePrice:
        "0",

      quantity:
        "0",

      positionSide,

      triggerPriceType:
        "MARK_PRICE",

      reduceOnly:
        true,
    };

    console.log(
      "[TEST] STOP LOSS REQUEST"
    );

    console.log(
      JSON.stringify(
        slBody,
        null,
        2
      )
    );

    const slResult =
      await this.client.post(
        "/capi/v3/placeTpSlOrder",
        slBody
      );

    // ----------------------------------------------------------
    // TAKE PROFIT
    // ----------------------------------------------------------

    const tpBody = {
      symbol:
        normalizedSymbol,

      clientAlgoId:
        `bot_tp_${normalizedSymbol.toLowerCase()}_${Date.now()}`,

      planType:
        "TAKE_PROFIT",

      triggerPrice:
        String(takeProfit),

      executePrice:
        "0",

      quantity:
        "0",

      positionSide,

      triggerPriceType:
        "MARK_PRICE",

      reduceOnly:
        true,
    };

    console.log(
      "[TEST] TAKE PROFIT REQUEST"
    );

    console.log(
      JSON.stringify(
        tpBody,
        null,
        2
      )
    );

    const tpResult =
      await this.client.post(
        "/capi/v3/placeTpSlOrder",
        tpBody
      );

    return {
      symbol:
        normalizedSymbol,

      direction:
        positionSide,

      entryPrice:
        averageEntry,

      stopLoss,

      takeProfit,

      slResult,

      tpResult,
    };
  }
}

module.exports =
  OrderService;