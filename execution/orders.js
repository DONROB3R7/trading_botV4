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

    // ==========================================================
    // TP TRACKING
    // ==========================================================

    this.activeTpOrderIds = new Map();
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

    // ----------------------------------------------------------
    // Clear locally tracked TP.
    // ----------------------------------------------------------

    this.activeTpOrderIds.delete(
      `${normalizedSymbol}:LONG`
    );

    this.activeTpOrderIds.delete(
      `${normalizedSymbol}:SHORT`
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
  // GET CURRENT ACTIVE CONDITIONAL ORDERS
  // ==========================================================
  //
  // IMPORTANT:
  //
  // /allAlgoOrders
  //     = HISTORY
  //
  // /openAlgoOrders
  //     = CURRENT ACTIVE CONDITIONAL ORDERS
  //
  // DO NOT use allAlgoOrders here.
  // ==========================================================

  async getCurrentConditionalOrders(
    symbol
  ) {
    const normalizedSymbol =
      String(symbol)
        .toUpperCase()
        .trim();

    console.log(
      `[TEST] GET CURRENT CONDITIONAL ORDERS ${normalizedSymbol}`
    );

    const result =
      await this.client.get(
        "/capi/v3/openAlgoOrders",
        {
          symbol:
            normalizedSymbol,

          page:
            1,

          limit:
            100,
        }
      );

    const orders =
      Array.isArray(
        result?.data
      )
        ? result.data
        : [];

    console.log(
      `[TEST] CURRENT CONDITIONAL ORDERS FOUND=${orders.length}`
    );

    console.log(
      JSON.stringify(
        orders,
        null,
        2
      )
    );

    return orders;
  }

  // ==========================================================
  // FIND CURRENT TAKE PROFIT
  // ==========================================================

  async findCurrentTakeProfit(
    symbol,
    positionSide,
    previousTpOrderId = null
  ) {
    const normalizedSymbol =
      String(symbol)
        .toUpperCase()
        .trim();

    const normalizedPositionSide =
      String(positionSide)
        .toUpperCase()
        .trim();

    const orders =
      await this.getCurrentConditionalOrders(
        normalizedSymbol
      );

    // ----------------------------------------------------------
    // First try the TP ID already tracked by the bot.
    //
    // IMPORTANT:
    // WEEX algo IDs are kept as STRINGS.
    // ----------------------------------------------------------

    if (
      previousTpOrderId !==
        null &&
      previousTpOrderId !==
        undefined
    ) {
      const trackedId =
        String(
          previousTpOrderId
        );

      const tracked =
        orders.find(
          (order) =>
            String(
              order.algoId || ""
            ) ===
              trackedId &&
            String(
              order.symbol || ""
            ).toUpperCase() ===
              normalizedSymbol &&
            String(
              order.positionSide || ""
            ).toUpperCase() ===
              normalizedPositionSide
        );

      if (tracked) {
        console.log(
          `[TEST] TRACKED ACTIVE TP FOUND | algoId=${String(
            tracked.algoId
          )}`
        );

        return tracked;
      }
    }

    // ----------------------------------------------------------
    // Find any active TP for this symbol + position side.
    // ----------------------------------------------------------

    const activeStatuses = [
      "NEW",
      "PENDING",
      "UNTRIGGERED",
    ];

    const tp =
      orders.find(
        (order) => {
          const orderType =
            String(
              order.orderType ||
                order.planType ||
                ""
            ).toUpperCase();

          const status =
            String(
              order.algoStatus ||
                ""
            ).toUpperCase();

          const symbolMatch =
            String(
              order.symbol || ""
            ).toUpperCase() ===
              normalizedSymbol;

          const sideMatch =
            String(
              order.positionSide || ""
            ).toUpperCase() ===
              normalizedPositionSide;

          const tpMatch =
            orderType ===
              "TAKE_PROFIT_MARKET" ||
            orderType ===
              "TAKE_PROFIT";

          const statusMatch =
            activeStatuses.includes(
              status
            );

          return (
            symbolMatch &&
            sideMatch &&
            tpMatch &&
            statusMatch
          );
        }
      );

    if (tp) {
      console.log(
        `[TEST] ACTIVE TP FOUND | algoId=${String(
          tp.algoId
        )} | trigger=${tp.triggerPrice}`
      );

      return tp;
    }

    console.log(
      `[TEST] NO ACTIVE TP FOUND FOR ${normalizedSymbol} ${normalizedPositionSide}`
    );

    return null;
  }

  // ==========================================================
  // MODIFY TAKE PROFIT
  // ==========================================================

  async modifyTakeProfit(
    orderId,
    takeProfit
  ) {
    if (
      orderId ===
        null ||
      orderId ===
        undefined
    ) {
      throw new Error(
        "Cannot modify TP without orderId"
      );
    }

    // ========================================================
    // IMPORTANT:
    //
    // WEEX algo/order IDs can be larger than JavaScript's
    // safe integer range.
    //
    // NEVER use Number(orderId).
    //
    // Keep the ID as a STRING.
    // ========================================================

    const safeOrderId =
      String(orderId);

    const body = {
      orderId:
        safeOrderId,

      triggerPrice:
        String(takeProfit),

      executePrice:
        "0",

      triggerPriceType:
        "MARK_PRICE",
    };

    console.log(
      "[TEST] MODIFY TAKE PROFIT REQUEST"
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
        "/capi/v3/modifyTpSlOrder",
        body
      );

    console.log(
      "[TEST] MODIFY TAKE PROFIT RESPONSE"
    );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;
  }

  // ==========================================================
  // CREATE / UPDATE TP + SL
  // ==========================================================
  //
  // FIRST ENTRY:
  //     Create SL
  //     Create TP
  //
  // ADDITIONAL ENTRY:
  //     Keep original SL
  //     Find CURRENT active TP
  //     MODIFY existing TP
  //
  // NEVER create a second TP when an active TP already exists.
  // ==========================================================

  async updateTestTpSl(
    symbol,
    slPercent,
    tpPercent,
    options = {}
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

    // ==========================================================
    // OPTIONS
    // ==========================================================

    const keepOriginalSl =
      Boolean(
        options.keepOriginalSl
      );

    const originalStopLoss =
      Number(
        options.originalStopLoss
      );

    const previousTpOrderId =
      options.previousTpOrderId ??
      null;

    // ==========================================================
    // GET CURRENT POSITION
    // ==========================================================

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

    // ==========================================================
    // FALLBACK ENTRY PRICE
    // ==========================================================

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
          openValue /
          size;
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

    // ==========================================================
    // CALCULATE TAKE PROFIT
    // ==========================================================

    let takeProfit;

    if (
      positionSide ===
      "LONG"
    ) {
      takeProfit =
        averageEntry *
        (1 + tp / 100);

    } else if (
      positionSide ===
      "SHORT"
    ) {
      takeProfit =
        averageEntry *
        (1 - tp / 100);

    } else {
      throw new Error(
        `Unknown position side: ${position.side}`
      );
    }

    takeProfit =
      Number(
        takeProfit.toFixed(5)
      );

    // ==========================================================
    // STOP LOSS
    // ==========================================================

    let stopLoss;

    if (
      keepOriginalSl
    ) {
      if (
        !Number.isFinite(
          originalStopLoss
        ) ||
        originalStopLoss <= 0
      ) {
        throw new Error(
          `Original Stop Loss is required when keepOriginalSl=true`
        );
      }

      stopLoss =
        Number(
          originalStopLoss.toFixed(5)
        );

    } else if (
      positionSide ===
      "LONG"
    ) {
      stopLoss =
        averageEntry *
        (1 - sl / 100);

      stopLoss =
        Number(
          stopLoss.toFixed(5)
        );

    } else {
      stopLoss =
        averageEntry *
        (1 + sl / 100);

      stopLoss =
        Number(
          stopLoss.toFixed(5)
        );
    }

    // ==========================================================
    // LOG
    // ==========================================================

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

    console.log(
      `[TEST] Keep Original SL=${keepOriginalSl}`
    );

    // ==========================================================
    // FIRST ENTRY
    // ==========================================================

    if (
      !keepOriginalSl
    ) {
      // --------------------------------------------------------
      // STOP LOSS
      // --------------------------------------------------------

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

      console.log(
        "[TEST] STOP LOSS RESPONSE"
      );

      console.log(
        JSON.stringify(
          slResult,
          null,
          2
        )
      );

      // --------------------------------------------------------
      // TAKE PROFIT
      // --------------------------------------------------------

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

      console.log(
        "[TEST] TAKE PROFIT RESPONSE"
      );

      console.log(
        JSON.stringify(
          tpResult,
          null,
          2
        )
      );

      // --------------------------------------------------------
      // Track TP ID
      //
      // IMPORTANT:
      // Convert to STRING immediately.
      // --------------------------------------------------------

      const rawTpOrderId =
        tpResult?.data?.orderId ||
        tpResult?.data?.[0]?.orderId ||
        tpResult?.orderId ||
        tpResult?.data?.[0]?.algoId ||
        null;

      const tpOrderId =
        rawTpOrderId !==
          null &&
        rawTpOrderId !==
          undefined
          ? String(rawTpOrderId)
          : null;

      if (
        tpOrderId !==
          null
      ) {
        this.activeTpOrderIds.set(
          `${normalizedSymbol}:${positionSide}`,
          tpOrderId
        );

        console.log(
          `[TEST] ACTIVE TP TRACKED | orderId=${tpOrderId}`
        );
      }

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

        tpOrderId,
      };
    }

    // ==========================================================
    // ADDITIONAL ENTRY
    // ==========================================================
    //
    // DO NOT CREATE ANOTHER SL.
    //
    // DO NOT CREATE ANOTHER TP.
    //
    // FIND THE EXISTING ACTIVE TP AND MODIFY IT.
    // ==========================================================

    console.log(
      "[TEST] ADDITIONAL ENTRY"
    );

    console.log(
      "[TEST] Original SL remains unchanged."
    );

    // ----------------------------------------------------------
    // Find current active TP
    // ----------------------------------------------------------

    let trackedTpId =
      previousTpOrderId;

    if (
      trackedTpId ===
        null ||
      trackedTpId ===
        undefined
    ) {
      trackedTpId =
        this.activeTpOrderIds.get(
          `${normalizedSymbol}:${positionSide}`
        ) ||
        null;
    }

    if (
      trackedTpId !==
        null &&
      trackedTpId !==
        undefined
    ) {
      trackedTpId =
        String(
          trackedTpId
        );
    }

    const activeTp =
      await this.findCurrentTakeProfit(
        normalizedSymbol,
        positionSide,
        trackedTpId
      );

    if (!activeTp) {
      throw new Error(
        `Active TP not found for ${normalizedSymbol} ${positionSide}. Refusing to create a duplicate TP.`
      );
    }

    // ==========================================================
    // IMPORTANT:
    // Keep WEEX algoId as STRING.
    // NEVER Number().
    // ==========================================================

    const activeTpId =
      String(
        activeTp.algoId
      );

    console.log(
      `[TEST] MODIFYING EXISTING TP | algoId=${activeTpId}`
    );

    console.log(
      `[TEST] OLD TP=${activeTp.triggerPrice}`
    );

    console.log(
      `[TEST] NEW TP=${takeProfit}`
    );

    // ----------------------------------------------------------
    // Modify existing TP
    // ----------------------------------------------------------

    const tpResult =
      await this.modifyTakeProfit(
        activeTpId,
        takeProfit
      );

    // ----------------------------------------------------------
    // Keep tracking same TP ID.
    // ----------------------------------------------------------

    this.activeTpOrderIds.set(
      `${normalizedSymbol}:${positionSide}`,
      activeTpId
    );

    console.log(
      `[TEST] TP MODIFIED | algoId=${activeTpId}`
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

      slResult:
        null,

      tpResult,

      tpOrderId:
        activeTpId,

      modifiedExistingTp:
        true,
    };
  }
}

module.exports =
  OrderService;
