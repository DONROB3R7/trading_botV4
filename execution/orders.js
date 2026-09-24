const WeexClient =
  require("./weexClient");

class OrderService {
  constructor(client = null) {
    this.client =
      client || new WeexClient();

    this.symbol =
      "POLUSDT";

    this.quantity =
      "10";

    this.leverage =
      "10";
  }

  // ============================================================
  // SET LEVERAGE
  // ============================================================

  async setLeverage() {
    const body = {
      symbol: this.symbol,
      marginType: "ISOLATED",
      isolatedLongLeverage: "10",
      isolatedShortLeverage: "10",
    };

    return await this.client.post(
      "/capi/v3/account/leverage",
      body
    );
  }

  // ============================================================
  // OPEN TEST POSITION
  // ============================================================

  async openTestPosition(side) {
    const requestedSide =
      String(side).toUpperCase();

    if (
      requestedSide !== "LONG" &&
      requestedSide !== "SHORT"
    ) {
      throw new Error(
        "Side must be LONG or SHORT."
      );
    }

    await this.setLeverage();

    const orderSide =
      requestedSide === "LONG"
        ? "BUY"
        : "SELL";

    const body = {
      symbol: this.symbol,
      side: orderSide,
      positionSide: requestedSide,
      type: "MARKET",
      quantity: this.quantity,
      newClientOrderId:
        `test_${requestedSide.toLowerCase()}_${Date.now()}`,
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

    return {
      success: true,
      side: requestedSide,
      symbol: this.symbol,
      quantity: this.quantity,
      leverage: this.leverage,
      order: result,
    };
  }

  // ============================================================
  // CLOSE TEST POSITION
  // ============================================================

  async closeTestPosition() {
    console.log(
      "[TEST] Checking POLUSDT position before CLOSE..."
    );

    const positions =
      await this.client.get(
        "/capi/v3/account/position/allPosition"
      );

    const positionList =
      positions.data || [];

    const position =
      positionList.find(
        (item) =>
          item.symbol ===
            this.symbol &&
          Number(item.size || 0) !== 0
      );

    if (!position) {
      throw new Error(
        "No open POLUSDT position."
      );
    }

    const positionSide =
      String(
        position.side || ""
      ).toUpperCase();

    const positionSize =
      String(
        Math.abs(
          Number(position.size)
        )
      );

    if (
      positionSide !== "LONG" &&
      positionSide !== "SHORT"
    ) {
      throw new Error(
        `Unknown POLUSDT position side: ${position.side}`
      );
    }

    if (
      !Number(positionSize) ||
      Number(positionSize) <= 0
    ) {
      throw new Error(
        "POLUSDT position size is invalid."
      );
    }

    const orderSide =
      positionSide === "LONG"
        ? "SELL"
        : "BUY";

    const body = {
      symbol: this.symbol,
      side: orderSide,
      positionSide: positionSide,
      type: "MARKET",
      quantity: positionSize,
      reduceOnly: true,
      newClientOrderId:
        `test_close_${Date.now()}`,
    };

    console.log(
      "[TEST] CLOSE POSITION"
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

    return {
      success: true,
      symbol: this.symbol,
      positionSide,
      quantity: positionSize,
      orderSide,
      order: result,
    };
  }

  // ============================================================
  // UPDATE TEST TP / SL
  // ============================================================

  async updateTestTpSl(
    slPercent,
    tpPercent
  ) {
    const sl =
      Number(slPercent);

    const tp =
      Number(tpPercent);

    if (
      !Number.isFinite(sl) ||
      sl <= 0
    ) {
      throw new Error(
        "SL percentage must be greater than 0."
      );
    }

    if (
      !Number.isFinite(tp) ||
      tp <= 0
    ) {
      throw new Error(
        "TP percentage must be greater than 0."
      );
    }

    console.log(
      "[TEST] Checking POLUSDT position for TP/SL..."
    );

    const positions =
      await this.client.get(
        "/capi/v3/account/position/allPosition"
      );

    const positionList =
      positions.data || [];

    const position =
      positionList.find(
        (item) =>
          item.symbol ===
            this.symbol &&
          Number(item.size || 0) !== 0
      );

    if (!position) {
      throw new Error(
        "No open POLUSDT position."
      );
    }

    const positionSide =
      String(
        position.side || ""
      ).toUpperCase();

    const size =
      Number(position.size);

    const openValue =
      Number(position.openValue);

    if (
      !Number.isFinite(size) ||
      size <= 0
    ) {
      throw new Error(
        "Invalid POLUSDT position size."
      );
    }

    if (
      !Number.isFinite(openValue) ||
      openValue <= 0
    ) {
      throw new Error(
        "Invalid POLUSDT open value."
      );
    }

    if (
      positionSide !== "LONG" &&
      positionSide !== "SHORT"
    ) {
      throw new Error(
        `Unknown POLUSDT position side: ${position.side}`
      );
    }

    const averageEntry =
      openValue / size;

    let stopLoss;
    let takeProfit;

    if (
      positionSide === "LONG"
    ) {
      stopLoss =
        averageEntry *
        (1 - sl / 100);

      takeProfit =
        averageEntry *
        (1 + tp / 100);
    } else {
      stopLoss =
        averageEntry *
        (1 + sl / 100);

      takeProfit =
        averageEntry *
        (1 - tp / 100);
    }

    stopLoss =
      Number(
        stopLoss.toFixed(5)
      );

    takeProfit =
      Number(
        takeProfit.toFixed(5)
      );

    console.log(
      "[TEST] TP/SL CALCULATION"
    );

    console.log({
      positionSide,
      averageEntry,
      slPercent: sl,
      tpPercent: tp,
      stopLoss,
      takeProfit,
    });

    // ==========================================================
    // STOP LOSS
    // ==========================================================

    const stopLossBody = {
      symbol: this.symbol,
      clientAlgoId:
        `test_sl_${Date.now()}`,
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
      "[TEST] SL REQUEST BODY"
    );

    console.log(
      JSON.stringify(
        stopLossBody,
        null,
        2
      )
    );

    const stopLossResult =
      await this.client.post(
        "/capi/v3/placeTpSlOrder",
        stopLossBody
      );

    // ==========================================================
    // TAKE PROFIT
    // ==========================================================

    const takeProfitBody = {
      symbol: this.symbol,
      clientAlgoId:
        `test_tp_${Date.now()}`,
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
      "[TEST] TP REQUEST BODY"
    );

    console.log(
      JSON.stringify(
        takeProfitBody,
        null,
        2
      )
    );

    const takeProfitResult =
      await this.client.post(
        "/capi/v3/placeTpSlOrder",
        takeProfitBody
      );

    return {
      success: true,
      symbol: this.symbol,
      positionSide,
      averageEntry,
      slPercent: sl,
      tpPercent: tp,
      stopLoss,
      takeProfit,
      stopLossOrder:
        stopLossResult,
      takeProfitOrder:
        takeProfitResult,
    };
  }
}

module.exports =
  OrderService;