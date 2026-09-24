const WeexClient = require("../execution/weexClient");

class MarketData {
  constructor(client = null) {
    this.client =
      client ||
      new WeexClient();
  }

  // ============================================================
  // CONTRACT INFO
  // ============================================================

  async getContractInfo(symbol) {
    const normalizedSymbol =
      String(symbol)
        .toUpperCase()
        .trim();

    return this.client.get(
      "/capi/v3/market/exchangeInfo",
      {
        symbol: normalizedSymbol,
      },
      false
    );
  }

  // ============================================================
  // API TRADING SYMBOLS
  // ============================================================

  async getApiTradingSymbols() {
    return this.client.get(
      "/capi/v3/market/apiTradingSymbols",
      {},
      false
    );
  }

  // ============================================================
  // MARK PRICE
  // ============================================================

  async getMarkPrice(symbol) {
    const normalizedSymbol =
      String(symbol)
        .toUpperCase()
        .trim();

    return this.client.get(
      "/capi/v3/market/symbolPrice",
      {
        symbol: normalizedSymbol,
        priceType: "MARK",
      },
      false
    );
  }

  // ============================================================
  // KLINES
  // ============================================================

  async getKlines(
    symbol,
    interval = "1m",
    limit = 200
  ) {
    const normalizedSymbol =
      String(symbol)
        .toUpperCase()
        .trim();

    if (!normalizedSymbol) {
      throw new Error(
        "Chart symbol is required"
      );
    }

    // ----------------------------------------------------------
    // Make sure the symbol is actually available for
    // WEEX API futures trading.
    // ----------------------------------------------------------

    const symbolsResult =
      await this.getApiTradingSymbols();

    const tradingSymbols =
      Array.isArray(
        symbolsResult?.data
      )
        ? symbolsResult.data
            .map(
              (item) =>
                String(item)
                  .toUpperCase()
                  .trim()
            )
        : [];

    if (
      !tradingSymbols.includes(
        normalizedSymbol
      )
    ) {
      throw new Error(
        `WEEX symbol is not available for API trading: ${normalizedSymbol}`
      );
    }

    // ----------------------------------------------------------
    // WEEX V3 Kline endpoint
    // ----------------------------------------------------------

    return this.client.get(
      "/capi/v3/market/klines",
      {
        symbol:
          normalizedSymbol,
        interval,
        limit,
      },
      false
    );
  }

  // ============================================================
  // COMBINED SYMBOL INFO
  // ============================================================

  async getSymbolInfo(symbol) {
    const normalizedSymbol =
      String(symbol)
        .toUpperCase()
        .trim();

    const [
      contractResult,
      priceResult,
    ] = await Promise.all([
      this.getContractInfo(
        normalizedSymbol
      ),
      this.getMarkPrice(
        normalizedSymbol
      ),
    ]);

    const contractData =
      contractResult.data;

    const priceData =
      priceResult.data;

    const symbols =
      Array.isArray(
        contractData?.symbols
      )
        ? contractData.symbols
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
        `WEEX contract not found: ${normalizedSymbol}`
      );
    }

    let price = null;

    if (
      priceData &&
      typeof priceData ===
        "object"
    ) {
      if (
        priceData.price !==
        undefined
      ) {
        price =
          priceData.price;
      } else if (
        priceData.markPrice !==
        undefined
      ) {
        price =
          priceData.markPrice;
      } else if (
        priceData.data &&
        priceData.data.price !==
          undefined
      ) {
        price =
          priceData.data.price;
      }
    }

    return {
      symbol:
        normalizedSymbol,

      price,

      pricePrecision:
        symbolInfo.pricePrecision ??
        null,

      quantityPrecision:
        symbolInfo.quantityPrecision ??
        null,

      baseAssetPrecision:
        symbolInfo.baseAssetPrecision ??
        null,

      contractVal:
        symbolInfo.contractVal ??
        null,

      minOrderSize:
        symbolInfo.minOrderSize ??
        null,

      maxOrderSize:
        symbolInfo.maxOrderSize ??
        null,

      maxPositionSize:
        symbolInfo.maxPositionSize ??
        null,

      marketOpenLimitSize:
        symbolInfo.marketOpenLimitSize ??
        null,

      makerFeeRate:
        symbolInfo.apiMakerFeeRate ??
        symbolInfo.makerFeeRate ??
        null,

      takerFeeRate:
        symbolInfo.apiTakerFeeRate ??
        symbolInfo.takerFeeRate ??
        null,

      minLeverage:
        symbolInfo.minLeverage ??
        null,

      maxLeverage:
        symbolInfo.maxLeverage ??
        null,

      raw:
        symbolInfo,
    };
  }
}

module.exports = MarketData;