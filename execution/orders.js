
const WeexClient = require("./weexClient");

class OrderService {
  constructor(client = null) {
    this.client = client || new WeexClient();

    const riskMode = "BASE"; // BASE, GOOD, EXTREME

    this.defaultMargin =
      riskMode === "GOOD"
        ? 2
        : riskMode === "EXTREME"
          ? 3
          : 1;

    this.defaultLeverage = "10";
    this.defaultMarginType = "ISOLATED";

    this.activeTpOrderIds = new Map();
  }

  // ==========================================================
  // GET SYMBOL CONTRACT INFORMATION
  // ==========================================================

  async getSymbolInfo(symbol) {
    const normalizedSymbol =
      String(symbol || "").toUpperCase().trim();

    if (!normalizedSymbol) {
      throw new Error("Symbol is required");
    }

    const result = await this.client.get(
      "/capi/v3/market/exchangeInfo",
      { symbol: normalizedSymbol },
      false
    );

    const data = result?.data;

    const symbols =
      Array.isArray(data)
        ? data
        : Array.isArray(data?.symbols)
          ? data.symbols
          : Array.isArray(data?.data)
            ? data.data
            : [];

    const symbolInfo = symbols.find(
      (item) =>
        String(item.symbol || "").toUpperCase() ===
        normalizedSymbol
    );

    if (!symbolInfo) {
      throw new Error(
        `WEEX symbol information not found for ${normalizedSymbol}`
      );
    }

    return symbolInfo;
  }

  // ==========================================================
  // GET SYMBOL PRICE PRECISION
  // ==========================================================

  async getPricePrecision(symbol) {
    const normalizedSymbol =
      String(symbol || "").toUpperCase().trim();

    const symbolInfo =
      await this.getSymbolInfo(normalizedSymbol);

    const precision = Number(symbolInfo.pricePrecision);

    if (
      !Number.isInteger(precision) ||
      precision < 0 ||
      precision > 100
    ) {
      throw new Error(
        `Invalid pricePrecision for ${normalizedSymbol}: ${symbolInfo.pricePrecision}`
      );
    }

    return precision;
  }

  // ==========================================================
  // ROUND PRICE
  // ==========================================================

  roundPrice(price, precision) {
    const numericPrice = Number(price);
    const digits = Number(precision);

    if (!Number.isFinite(numericPrice)) {
      throw new Error(`Invalid price: ${price}`);
    }

    if (
      !Number.isInteger(digits) ||
      digits < 0 ||
      digits > 100
    ) {
      throw new Error(
        `Invalid price precision: ${precision}`
      );
    }

    return Number(numericPrice.toFixed(digits));
  }

  // ==========================================================
  // GET CURRENT SYMBOL PRICE
  // ==========================================================

  async getSymbolPrice(symbol) {
    const normalizedSymbol =
      String(symbol || "").toUpperCase().trim();

    if (!normalizedSymbol) {
      throw new Error("Symbol is required");
    }

    const result = await this.client.get(
      "/capi/v3/market/symbolPrice",
      {
        symbol: normalizedSymbol,
        priceType: "MARK",
      },
      false
    );

    const data = result?.data;

    const price = Number(
      data?.price ?? data?.markPrice ?? 0
    );

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(
        `Could not determine current price for ${normalizedSymbol}`
      );
    }

    return price;
  }

  // ==========================================================
  // CALCULATE ORDER QUANTITY
  // ==========================================================

  async calculateOrderQuantity(symbol, options = {}) {
    const normalizedSymbol =
      String(symbol || "").toUpperCase().trim();

    if (!normalizedSymbol) {
      throw new Error("Symbol is required");
    }

    const tradeNumber = Math.max(
      1,
      Math.floor(Number(options.tradeNumber) || 1)
    );

    const allowedMultipliers = [1, 1.5, 2, 2.5, 3];

    const requestedMultiplier = Number(
      options.pyramidPositionMultiplier ?? 1
    );

    const pyramidPositionMultiplier =
      allowedMultipliers.includes(requestedMultiplier)
        ? requestedMultiplier
        : 1;

    // Entry #1 always uses 1x.
    // Additional entries use the selected multiplier.
    const effectiveMultiplier =
      tradeNumber === 1
        ? 1
        : pyramidPositionMultiplier;

    const symbolInfo =
      await this.getSymbolInfo(normalizedSymbol);

    const markPrice =
      await this.getSymbolPrice(normalizedSymbol);

    const leverage = Number(this.defaultLeverage);

    if (!Number.isFinite(leverage) || leverage <= 0) {
      throw new Error(
        `Invalid leverage: ${this.defaultLeverage}`
      );
    }

    // Risk mode supplied by Manage Bot.
    const riskMargins = {
      BASE: 1,
      GOOD: 2,
      EXTREME: 3,
    };

    const riskLevel =
      String(options.riskLevel || "BASE")
        .trim()
        .toUpperCase();

    const baseMargin =
      riskMargins[riskLevel] ?? 1;

    const targetMargin =
      baseMargin * effectiveMultiplier;

    const targetNotional =
      targetMargin * leverage;

    const rawQuantity =
      targetNotional / markPrice;

    if (
      !Number.isFinite(rawQuantity) ||
      rawQuantity <= 0
    ) {
      throw new Error(
        `Could not calculate quantity for ${normalizedSymbol}`
      );
    }

    const quantityPrecision =
      Number.isFinite(Number(symbolInfo.quantityPrecision))
        ? Number(symbolInfo.quantityPrecision)
        : 8;

    if (
      !Number.isInteger(quantityPrecision) ||
      quantityPrecision < -100 ||
      quantityPrecision > 100
    ) {
      throw new Error(
        `Invalid quantityPrecision for ${normalizedSymbol}: ${symbolInfo.quantityPrecision}`
      );
    }

    // WEEX negative precision means whole-number steps.
    // Example: -1 means quantity steps of 10.
    const quantityStep =
      quantityPrecision >= 0
        ? Math.pow(10, -quantityPrecision)
        : Math.pow(10, Math.abs(quantityPrecision));

    if (
      !Number.isFinite(quantityStep) ||
      quantityStep <= 0
    ) {
      throw new Error(
        `Invalid quantity step for ${normalizedSymbol}`
      );
    }

    let quantity =
      Math.floor(rawQuantity / quantityStep) *
      quantityStep;

    const minOrderSize =
      Number(symbolInfo.minOrderSize);

    if (
      Number.isFinite(minOrderSize) &&
      minOrderSize > 0 &&
      quantity < minOrderSize
    ) {
      quantity = minOrderSize;
    }

    quantity =
      Math.ceil(
        (quantity / quantityStep) - 1e-10
      ) * quantityStep;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(
        `${normalizedSymbol} calculated quantity is invalid. ` +
        `Trade=${tradeNumber} | ` +
        `Margin=${targetMargin} USDT | ` +
        `Leverage=${this.defaultLeverage}x | ` +
        `Price=${markPrice} | ` +
        `Precision=${quantityPrecision}`
      );
    }

    const maxOrderSize =
      Number(symbolInfo.maxOrderSize);

    if (
      Number.isFinite(maxOrderSize) &&
      maxOrderSize > 0 &&
      quantity > maxOrderSize
    ) {
      throw new Error(
        `${normalizedSymbol} quantity ${quantity} exceeds WEEX maxOrderSize ${maxOrderSize}`
      );
    }

    const marketOpenLimitSize =
      Number(symbolInfo.marketOpenLimitSize);

    if (
      Number.isFinite(marketOpenLimitSize) &&
      marketOpenLimitSize > 0 &&
      quantity > marketOpenLimitSize
    ) {
      throw new Error(
        `${normalizedSymbol} quantity ${quantity} exceeds WEEX marketOpenLimitSize ${marketOpenLimitSize}`
      );
    }

    const estimatedNotional =
      markPrice * quantity;

    const estimatedMargin =
      estimatedNotional / leverage;

    // Never call toFixed with negative precision.
    const formattedQuantity =
      quantityPrecision >= 0
        ? quantity.toFixed(quantityPrecision)
        : String(Math.round(quantity));

    return {
      quantity: formattedQuantity,
      numericQuantity: quantity,
      markPrice,
      quantityPrecision,
      quantityStep,
      minOrderSize,
      tradeNumber,
      pyramidPositionMultiplier,
      effectiveMultiplier,
      baseMargin,
      targetMargin,
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
      String(symbol || "").toUpperCase().trim();

    if (!normalizedSymbol) {
      throw new Error("Symbol is required");
    }

    return this.client.post(
      "/capi/v3/account/leverage",
      {
        symbol: normalizedSymbol,
        marginType: this.defaultMarginType,
        isolatedLongLeverage: this.defaultLeverage,
        isolatedShortLeverage: this.defaultLeverage,
      }
    );
  }

  // ==========================================================
  // OPEN POSITION
  // ==========================================================

  async openTestPosition(symbol, direction, options = {}) {
    const normalizedSymbol =
      String(symbol || "").toUpperCase().trim();

    const normalizedDirection =
      String(direction || "").toUpperCase().trim();

    if (!normalizedSymbol) {
      throw new Error("Symbol is required");
    }

    if (
      normalizedDirection !== "LONG" &&
      normalizedDirection !== "SHORT"
    ) {
      throw new Error("Direction must be LONG or SHORT");
    }

    await this.setLeverage(normalizedSymbol);

    const sizing =
      await this.calculateOrderQuantity(
        normalizedSymbol,
        options
      );

    const quantity = sizing.quantity;

    const side =
      normalizedDirection === "LONG"
        ? "BUY"
        : "SELL";

    const positionSide = normalizedDirection;

    const clientOrderId =
      `bot_${normalizedSymbol.toLowerCase()}_${Date.now()}`;

    const body = {
      symbol: normalizedSymbol,
      side,
      positionSide,
      type: "MARKET",
      quantity,
      newClientOrderId: clientOrderId,
    };

    const result = await this.client.post(
      "/capi/v3/order",
      body
    );

    return {
      ...result,
      symbol: normalizedSymbol,
      direction: normalizedDirection,
      side,
      positionSide,
      quantity,
      tradeNumber: sizing.tradeNumber,
      pyramidPositionMultiplier:
        sizing.pyramidPositionMultiplier,
      effectiveMultiplier: sizing.effectiveMultiplier,
      targetMargin: sizing.targetMargin,
      targetNotional: sizing.targetNotional,
      estimatedNotional: sizing.estimatedNotional,
      estimatedMargin: sizing.estimatedMargin,
      markPrice: sizing.markPrice,
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
      String(symbol || "").toUpperCase().trim();

    if (!normalizedSymbol) {
      throw new Error("Symbol is required");
    }

    const params = {
      symbol: normalizedSymbol,
      limit: Math.min(
        100,
        Math.max(1, Number(limit) || 100)
      ),
    };

    if (startTime !== null && startTime !== undefined) {
      params.startTime = Number(startTime);
    }

    if (endTime !== null && endTime !== undefined) {
      params.endTime = Number(endTime);
    }

    const result = await this.client.get(
      "/capi/v3/userTrades",
      params
    );

    return Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result)
        ? result
        : [];
  }

  // ==========================================================
  // CLOSE POSITION
  // ==========================================================

  async closeTestPosition(symbol) {
    const normalizedSymbol =
      String(symbol || "").toUpperCase().trim();

    if (!normalizedSymbol) {
      throw new Error("Symbol is required");
    }

    const result = await this.client.get(
      "/capi/v3/account/position/allPosition"
    );

    const positions =
      Array.isArray(result?.data)
        ? result.data
        : [];

    const position = positions.find(
      (item) =>
        String(item.symbol || "").toUpperCase() ===
          normalizedSymbol &&
        Number(item.size || 0) !== 0
    );

    if (!position) {
      throw new Error(
        `No open ${normalizedSymbol} position found`
      );
    }

    const positionSide =
      String(position.side || "").toUpperCase();

    const numericQuantity =
      Math.abs(Number(position.size));

    if (
      !Number.isFinite(numericQuantity) ||
      numericQuantity <= 0
    ) {
      throw new Error(
        `Invalid position quantity for ${normalizedSymbol}`
      );
    }

    if (
      positionSide !== "LONG" &&
      positionSide !== "SHORT"
    ) {
      throw new Error(
        `Unknown position side: ${position.side}`
      );
    }

    const side =
      positionSide === "LONG"
        ? "SELL"
        : "BUY";

    const quantity = String(numericQuantity);

    const body = {
      symbol: normalizedSymbol,
      side,
      positionSide,
      type: "MARKET",
      quantity,
      reduceOnly: true,
      newClientOrderId:
        `bot_close_${normalizedSymbol.toLowerCase()}_${Date.now()}`,
    };

    const closeResult = await this.client.post(
      "/capi/v3/order",
      body
    );

    this.activeTpOrderIds.delete(
      `${normalizedSymbol}:LONG`
    );

    this.activeTpOrderIds.delete(
      `${normalizedSymbol}:SHORT`
    );

    return {
      ...closeResult,
      symbol: normalizedSymbol,
      direction: positionSide,
      quantity,
    };
  }

  // ==========================================================
  // GET CURRENT CONDITIONAL ORDERS
  // ==========================================================

  async getCurrentConditionalOrders(symbol) {
    const normalizedSymbol =
      String(symbol || "").toUpperCase().trim();

    const result = await this.client.get(
      "/capi/v3/openAlgoOrders",
      {
        symbol: normalizedSymbol,
        page: 1,
        limit: 100,
      }
    );

    return Array.isArray(result?.data)
      ? result.data
      : [];
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
      String(symbol || "").toUpperCase().trim();

    const normalizedPositionSide =
      String(positionSide || "").toUpperCase().trim();

    const orders =
      await this.getCurrentConditionalOrders(
        normalizedSymbol
      );

    if (
      previousTpOrderId !== null &&
      previousTpOrderId !== undefined
    ) {
      const trackedId = String(previousTpOrderId);

      const tracked = orders.find(
        (order) =>
          String(order.algoId || "") === trackedId &&
          String(order.symbol || "").toUpperCase() ===
            normalizedSymbol &&
          String(order.positionSide || "").toUpperCase() ===
            normalizedPositionSide
      );

      if (tracked) {
        return tracked;
      }
    }

    const activeStatuses = [
      "NEW",
      "PENDING",
      "UNTRIGGERED",
    ];

    return (
      orders.find((order) => {
        const orderType =
          String(
            order.orderType ||
            order.planType ||
            ""
          ).toUpperCase();

        const status =
          String(order.algoStatus || "").toUpperCase();

        const symbolMatch =
          String(order.symbol || "").toUpperCase() ===
          normalizedSymbol;

        const sideMatch =
          String(order.positionSide || "").toUpperCase() ===
          normalizedPositionSide;

        const tpMatch =
          orderType === "TAKE_PROFIT_MARKET" ||
          orderType === "TAKE_PROFIT";

        return (
          symbolMatch &&
          sideMatch &&
          tpMatch &&
          activeStatuses.includes(status)
        );
      }) || null
    );
  }

  // ==========================================================
  // MODIFY TAKE PROFIT
  // ==========================================================

  async modifyTakeProfit(orderId, takeProfit) {
    if (orderId === null || orderId === undefined) {
      throw new Error("Cannot modify TP without orderId");
    }

    const body = {
      orderId: String(orderId),
      triggerPrice: String(takeProfit),
      executePrice: "0",
      triggerPriceType: "MARK_PRICE",
    };

    return this.client.post(
      "/capi/v3/modifyTpSlOrder",
      body
    );
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
      String(symbol || "").toUpperCase().trim();

    const sl = Number(slPercent);
    const tp = Number(tpPercent);

    if (!Number.isFinite(sl) || sl <= 0) {
      throw new Error(
        "Stop Loss must be greater than 0"
      );
    }

    if (!Number.isFinite(tp) || tp <= 0) {
      throw new Error(
        "Take Profit must be greater than 0"
      );
    }

    const keepOriginalSl =
      Boolean(options.keepOriginalSl);

    const originalStopLoss =
      Number(options.originalStopLoss);

    const previousTpOrderId =
      options.previousTpOrderId ?? null;

    const result = await this.client.get(
      "/capi/v3/account/position/allPosition"
    );

    const positions =
      Array.isArray(result?.data)
        ? result.data
        : [];

    const position = positions.find(
      (item) =>
        String(item.symbol || "").toUpperCase() ===
          normalizedSymbol &&
        Number(item.size || 0) !== 0
    );

    if (!position) {
      throw new Error(
        `No open ${normalizedSymbol} position found`
      );
    }

    const positionSide =
      String(position.side || "").toUpperCase();

    const pricePrecision =
      await this.getPricePrecision(normalizedSymbol);

    const size =
      Math.abs(Number(position.size));

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
      (!Number.isFinite(averageEntry) ||
        averageEntry <= 0) &&
      openValue > 0 &&
      size > 0
    ) {
      averageEntry = openValue / size;
    }

    if (
      !Number.isFinite(averageEntry) ||
      averageEntry <= 0
    ) {
      throw new Error(
        `Could not determine entry price for ${normalizedSymbol}`
      );
    }

    let takeProfit;

    if (positionSide === "LONG") {
      takeProfit =
        averageEntry * (1 + tp / 100);
    } else if (positionSide === "SHORT") {
      takeProfit =
        averageEntry * (1 - tp / 100);
    } else {
      throw new Error(
        `Unknown position side: ${position.side}`
      );
    }

    takeProfit =
      this.roundPrice(takeProfit, pricePrecision);

    let stopLoss;

    if (keepOriginalSl) {
      if (
        !Number.isFinite(originalStopLoss) ||
        originalStopLoss <= 0
      ) {
        throw new Error(
          "Original Stop Loss is required when keepOriginalSl=true"
        );
      }

      stopLoss =
        this.roundPrice(
          originalStopLoss,
          pricePrecision
        );
    } else if (positionSide === "LONG") {
      stopLoss =
        this.roundPrice(
          averageEntry * (1 - sl / 100),
          pricePrecision
        );
    } else {
      stopLoss =
        this.roundPrice(
          averageEntry * (1 + sl / 100),
          pricePrecision
        );
    }

    // FIRST ENTRY
    if (!keepOriginalSl) {
      const slBody = {
        symbol: normalizedSymbol,
        clientAlgoId:
          `bot_sl_${normalizedSymbol.toLowerCase()}_${Date.now()}`,
        planType: "STOP_LOSS",
        triggerPrice: String(stopLoss),
        executePrice: "0",
        quantity: "0",
        positionSide,
        triggerPriceType: "MARK_PRICE",
        reduceOnly: true,
      };

      const slResult = await this.client.post(
        "/capi/v3/placeTpSlOrder",
        slBody
      );

      const tpBody = {
        symbol: normalizedSymbol,
        clientAlgoId:
          `bot_tp_${normalizedSymbol.toLowerCase()}_${Date.now()}`,
        planType: "TAKE_PROFIT",
        triggerPrice: String(takeProfit),
        executePrice: "0",
        quantity: "0",
        positionSide,
        triggerPriceType: "MARK_PRICE",
        reduceOnly: true,
      };

      const tpResult = await this.client.post(
        "/capi/v3/placeTpSlOrder",
        tpBody
      );

      const rawTpOrderId =
        tpResult?.data?.orderId ||
        tpResult?.data?.[0]?.orderId ||
        tpResult?.orderId ||
        tpResult?.data?.[0]?.algoId ||
        null;

      const tpOrderId =
        rawTpOrderId !== null &&
        rawTpOrderId !== undefined
          ? String(rawTpOrderId)
          : null;

      if (tpOrderId !== null) {
        this.activeTpOrderIds.set(
          `${normalizedSymbol}:${positionSide}`,
          tpOrderId
        );
      }

      return {
        symbol: normalizedSymbol,
        direction: positionSide,
        entryPrice: averageEntry,
        stopLoss,
        takeProfit,
        slResult,
        tpResult,
        tpOrderId,
      };
    }

    // ADDITIONAL ENTRY: KEEP ORIGINAL STOP LOSS
    let trackedTpId = previousTpOrderId;

    if (
      trackedTpId === null ||
      trackedTpId === undefined
    ) {
      trackedTpId =
        this.activeTpOrderIds.get(
          `${normalizedSymbol}:${positionSide}`
        ) || null;
    }

    if (
      trackedTpId !== null &&
      trackedTpId !== undefined
    ) {
      trackedTpId = String(trackedTpId);
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

    if (
      activeTp.algoId === null ||
      activeTp.algoId === undefined
    ) {
      throw new Error(
        `Active TP has no algoId for ${normalizedSymbol} ${positionSide}`
      );
    }

    const activeTpId = String(activeTp.algoId);

    const tpResult =
      await this.modifyTakeProfit(
        activeTpId,
        takeProfit
      );

    this.activeTpOrderIds.set(
      `${normalizedSymbol}:${positionSide}`,
      activeTpId
    );

    return {
      symbol: normalizedSymbol,
      direction: positionSide,
      entryPrice: averageEntry,
      stopLoss,
      takeProfit,
      slResult: null,
      tpResult,
      tpOrderId: activeTpId,
      modifiedExistingTp: true,
    };
  }
}

module.exports = OrderService;
