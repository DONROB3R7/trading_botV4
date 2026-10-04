const WeexClient = require("./weexClient");

class OrderService {
  constructor(client = null) {
    this.client =
      client ||
      new WeexClient();

    // ==========================================================
    // DEFAULT TEST SETTINGS
    // ==========================================================

    this.defaultMargin = 1;
    this.defaultLeverage = "10";
    this.defaultMarginType = "ISOLATED";

    // ==========================================================
    // TP TRACKING
    // ==========================================================

    this.activeTpOrderIds = new Map();
  }

  // ==========================================================
  // GET SYMBOL CONTRACT INFORMATION
  // ==========================================================

  async getSymbolInfo(symbol) {
    const normalizedSymbol =
      String(symbol || "")
        .toUpperCase()
        .trim();

    if (!normalizedSymbol) {
      throw new Error(
        "Symbol is required"
      );
    }

    console.log(
      `[TEST] GET SYMBOL INFO | ${normalizedSymbol}`
    );

    const result =
      await this.client.get(
        "/capi/v3/market/exchangeInfo",
        {
          symbol:
            normalizedSymbol,
        },
        false
      );

    const data =
      result?.data;

    const symbols =
      Array.isArray(data)
        ? data
        : Array.isArray(
            data?.symbols
          )
          ? data.symbols
          : Array.isArray(
              data?.data
            )
            ? data.data
            : [];

    const symbolInfo =
      symbols.find(
        (item) =>
          String(
            item.symbol || ""
          ).toUpperCase() ===
          normalizedSymbol
      );

    if (!symbolInfo) {
      throw new Error(
        `WEEX symbol information not found for ${normalizedSymbol}`
      );
    }

    console.log(
      `[TEST] SYMBOL INFO | ${normalizedSymbol}`
    );

    console.log(
      JSON.stringify(
        symbolInfo,
        null,
        2
      )
    );

    return symbolInfo;
  }

  // ==========================================================
  // GET SYMBOL PRICE PRECISION
  // ==========================================================

  async getPricePrecision(symbol) {
    const normalizedSymbol =
      String(symbol || "")
        .toUpperCase()
        .trim();

    const symbolInfo =
      await this.getSymbolInfo(
        normalizedSymbol
      );

    const precision =
      Number(
        symbolInfo.pricePrecision
      );

    if (
      !Number.isFinite(
        precision
      ) ||
      precision < 0
    ) {
      throw new Error(
        `Invalid pricePrecision for ${normalizedSymbol}: ${symbolInfo.pricePrecision}`
      );
    }

    console.log(
      `[TEST] PRICE PRECISION | ${normalizedSymbol} = ${precision}`
    );

    return precision;
  }

  // ==========================================================
  // ROUND PRICE TO WEEX PRECISION
  // ==========================================================

  roundPrice(
    price,
    precision
  ) {
    const numericPrice =
      Number(price);

    if (
      !Number.isFinite(
        numericPrice
      )
    ) {
      throw new Error(
        `Invalid price: ${price}`
      );
    }

    return Number(
      numericPrice.toFixed(
        precision
      )
    );
  }

  // ==========================================================
  // GET CURRENT SYMBOL PRICE
  // ==========================================================

  async getSymbolPrice(symbol) {
    const normalizedSymbol =
      String(symbol || "")
        .toUpperCase()
        .trim();

    if (!normalizedSymbol) {
      throw new Error(
        "Symbol is required"
      );
    }

    console.log(
      `[TEST] GET MARK PRICE | ${normalizedSymbol}`
    );

    const result =
      await this.client.get(
        "/capi/v3/market/symbolPrice",
        {
          symbol:
            normalizedSymbol,

          priceType:
            "MARK",
        },
        false
      );

    const data =
      result?.data;

    const price =
      Number(
        data?.price ??
        data?.markPrice ??
        0
      );

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new Error(
        `Could not determine current price for ${normalizedSymbol}`
      );
    }

    console.log(
      `[TEST] ${normalizedSymbol} MARK PRICE=${price}`
    );

    return price;
  }

  // ==========================================================
  // CALCULATE ORDER QUANTITY
  // ==========================================================

  async calculateOrderQuantity(
    symbol
  ) {
    const normalizedSymbol =
      String(symbol || "")
        .toUpperCase()
        .trim();

    const symbolInfo =
      await this.getSymbolInfo(
        normalizedSymbol
      );

    const markPrice =
      await this.getSymbolPrice(
        normalizedSymbol
      );

    const leverage =
      Number(
        this.defaultLeverage
      );

    if (
      !Number.isFinite(leverage) ||
      leverage <= 0
    ) {
      throw new Error(
        `Invalid leverage: ${this.defaultLeverage}`
      );
    }

    const targetNotional =
      this.defaultMargin *
      leverage;

    const rawQuantity =
      targetNotional /
      markPrice;

    if (
      !Number.isFinite(
        rawQuantity
      ) ||
      rawQuantity <= 0
    ) {
      throw new Error(
        `Could not calculate quantity for ${normalizedSymbol}`
      );
    }

    const quantityPrecision =
      Number.isFinite(
        Number(
          symbolInfo.quantityPrecision
        )
      )
        ? Number(
            symbolInfo.quantityPrecision
          )
        : 8;

    let quantityStep;

    if (
      quantityPrecision >= 0
    ) {
      quantityStep =
        1 /
        Math.pow(
          10,
          quantityPrecision
        );
    } else {
      quantityStep =
        Math.pow(
          10,
          Math.abs(
            quantityPrecision
          )
        );
    }

    let quantity =
      Math.floor(
        rawQuantity /
        quantityStep
      ) *
      quantityStep;

    const minOrderSize =
      Number(
        symbolInfo.minOrderSize
      );

    if (
      Number.isFinite(
        minOrderSize
      ) &&
      minOrderSize > 0 &&
      quantity < minOrderSize
    ) {
      quantity =
        minOrderSize;
    }

    if (
      quantityStep > 0
    ) {
      quantity =
        Math.ceil(
          quantity /
          quantityStep
        ) *
        quantityStep;
    }

    if (
      !Number.isFinite(
        quantity
      ) ||
      quantity <= 0
    ) {
      throw new Error(
        `${normalizedSymbol} calculated quantity is invalid. ` +
        `Margin=${this.defaultMargin} USDT | ` +
        `Leverage=${this.defaultLeverage}x | ` +
        `Price=${markPrice} | ` +
        `Precision=${quantityPrecision}`
      );
    }

    const maxOrderSize =
      Number(
        symbolInfo.maxOrderSize
      );

    if (
      Number.isFinite(
        maxOrderSize
      ) &&
      maxOrderSize > 0 &&
      quantity > maxOrderSize
    ) {
      throw new Error(
        `${normalizedSymbol} calculated quantity ${quantity} ` +
        `exceeds WEEX maxOrderSize ${maxOrderSize}`
      );
    }

    const marketOpenLimitSize =
      Number(
        symbolInfo.marketOpenLimitSize
      );

    if (
      Number.isFinite(
        marketOpenLimitSize
      ) &&
      marketOpenLimitSize > 0 &&
      quantity > marketOpenLimitSize
    ) {
      throw new Error(
        `${normalizedSymbol} calculated quantity ${quantity} ` +
        `exceeds WEEX marketOpenLimitSize ${marketOpenLimitSize}`
      );
    }

    const estimatedNotional =
      markPrice *
      quantity;

    const estimatedMargin =
      estimatedNotional /
      leverage;

    console.log(
      "=========================================================="
    );

    console.log(
      `[TEST] ORDER SIZE CALCULATION | ${normalizedSymbol}`
    );

    console.log(
      `[TEST] Target Margin=${this.defaultMargin} USDT`
    );

    console.log(
      `[TEST] Leverage=${this.defaultLeverage}x`
    );

    console.log(
      `[TEST] Target Notional=${targetNotional} USDT`
    );

    console.log(
      `[TEST] Mark Price=${markPrice}`
    );

    console.log(
      `[TEST] Raw Quantity=${rawQuantity}`
    );

    console.log(
      `[TEST] Quantity Precision=${quantityPrecision}`
    );

    console.log(
      `[TEST] Quantity Step=${quantityStep}`
    );

    console.log(
      `[TEST] Minimum Order Size=${minOrderSize || "none"}`
    );

    console.log(
      `[TEST] Final Quantity=${quantity}`
    );

    console.log(
      `[TEST] Estimated Notional=${estimatedNotional.toFixed(6)} USDT`
    );

    console.log(
      `[TEST] Estimated Margin=${estimatedMargin.toFixed(6)} USDT`
    );

    console.log(
      "=========================================================="
    );

    return {
      quantity:
        String(quantity),

      numericQuantity:
        quantity,

      markPrice,

      quantityPrecision,

      quantityStep,

      minOrderSize,

      targetMargin:
        this.defaultMargin,

      targetNotional,

      estimatedNotional,

      estimatedMargin,

      symbolInfo,
    };
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
      String(symbol || "")
        .toUpperCase()
        .trim();

    const normalizedDirection =
      String(direction || "")
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

    await this.setLeverage(
      normalizedSymbol
    );

    const sizing =
      await this.calculateOrderQuantity(
        normalizedSymbol
      );

    const quantity =
      sizing.quantity;

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

      quantity,

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

      quantity,

      targetMargin:
        sizing.targetMargin,

      targetNotional:
        sizing.targetNotional,

      estimatedNotional:
        sizing.estimatedNotional,

      estimatedMargin:
        sizing.estimatedMargin,

      markPrice:
        sizing.markPrice,
    };
  }

  // ==========================================================
  // GET USER TRADE HISTORY
  // ==========================================================

  async getUserTrades(
    symbol,
    startTime = null,
    endTime = null,
    limit = 100
  ) {
    const normalizedSymbol =
      String(symbol || "")
        .toUpperCase()
        .trim();

    if (!normalizedSymbol) {
      throw new Error(
        "Symbol is required"
      );
    }

    const params = {
      symbol:
        normalizedSymbol,

      limit:
        Math.min(
          100,
          Math.max(
            1,
            Number(limit) || 100
          )
        ),
    };

    if (
      startTime !== null &&
      startTime !== undefined
    ) {
      params.startTime =
        Number(startTime);
    }

    if (
      endTime !== null &&
      endTime !== undefined
    ) {
      params.endTime =
        Number(endTime);
    }

    console.log(
      `[TEST] GET USER TRADES | ` +
      `${normalizedSymbol} | ` +
      `Start=${params.startTime || "default"} | ` +
      `End=${params.endTime || "default"}`
    );

    const result =
      await this.client.get(
        "/capi/v3/userTrades",
        params
      );

    const trades =
      Array.isArray(
        result?.data
      )
        ? result.data
        : Array.isArray(result)
          ? result
          : [];

    console.log(
      `[TEST] USER TRADES FOUND=${trades.length}`
    );

    return trades;
  }

  // ==========================================================
  // CLOSE POSITION
  // ==========================================================

  async closeTestPosition(
    symbol
  ) {
    const normalizedSymbol =
      String(symbol || "")
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

  async getCurrentConditionalOrders(
    symbol
  ) {
    const normalizedSymbol =
      String(symbol || "")
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
      String(symbol || "")
        .toUpperCase()
        .trim();

    const normalizedPositionSide =
      String(positionSide || "")
        .toUpperCase()
        .trim();

    const orders =
      await this.getCurrentConditionalOrders(
        normalizedSymbol
      );

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

  async updateTestTpSl(
    symbol,
    slPercent,
    tpPercent,
    options = {}
  ) {
    const normalizedSymbol =
      String(symbol || "")
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

    // ========================================================
    // GET WEEX PRICE PRECISION
    // ========================================================

    const pricePrecision =
      await this.getPricePrecision(
        normalizedSymbol
      );

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

    // ========================================================
    // DYNAMIC WEEX PRICE PRECISION
    // ========================================================

    takeProfit =
      this.roundPrice(
        takeProfit,
        pricePrecision
      );

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
        this.roundPrice(
          originalStopLoss,
          pricePrecision
        );

    } else if (
      positionSide ===
      "LONG"
    ) {
      stopLoss =
        averageEntry *
        (1 - sl / 100);

      stopLoss =
        this.roundPrice(
          stopLoss,
          pricePrecision
        );

    } else {
      stopLoss =
        averageEntry *
        (1 + sl / 100);

      stopLoss =
        this.roundPrice(
          stopLoss,
          pricePrecision
        );
    }

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
      `[TEST] Price Precision=${pricePrecision}`
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

        // IMPORTANT:
        // Keep quantity=0.
        // Previous tests showed that changing this
        // can cause incorrect partial-close behavior.
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

        // IMPORTANT:
        // Keep quantity=0.
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

    console.log(
      "[TEST] ADDITIONAL ENTRY"
    );

    console.log(
      "[TEST] Original SL remains unchanged."
    );

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

    const tpResult =
      await this.modifyTakeProfit(
        activeTpId,
        takeProfit
      );

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