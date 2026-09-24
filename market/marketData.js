const WeexClient = require("../execution/weexClient");

// ============================================================
// MARKET DATA
// ============================================================

class MarketData {
  constructor(client = null) {
    this.client =
      client ||
      new WeexClient();
  }

  // ==========================================================
  // CONTRACT INFORMATION
  // ==========================================================

  async getContractInfo(symbol) {
    const normalizedSymbol =
      String(symbol).toUpperCase();

    return this.client.get(
      "/capi/v3/market/exchangeInfo",
      {
        symbol: normalizedSymbol,
      },
      false
    );
  }

  // ==========================================================
  // MARK PRICE
  // ==========================================================

  async getMarkPrice(symbol) {
    const normalizedSymbol =
      String(symbol).toUpperCase();

    return this.client.get(
      "/capi/v3/market/symbolPrice",
      {
        symbol: normalizedSymbol,
        priceType: "MARK",
      },
      false
    );
  }

  // ==========================================================
  // SYMBOL INFORMATION
  // ==========================================================

  async getSymbolInfo(symbol) {
    const normalizedSymbol =
      String(symbol).toUpperCase();

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

    // --------------------------------------------------------
    // WEEX may return symbols as an array.
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Price response
    // --------------------------------------------------------

    let price = null;

    if (
      priceData &&
      typeof priceData === "object"
    ) {
      if (
        priceData.price !== undefined
      ) {
        price =
          priceData.price;
      } else if (
        priceData.markPrice !== undefined
      ) {
        price =
          priceData.markPrice;
      } else if (
        priceData.data &&
        priceData.data.price !== undefined
      ) {
        price =
          priceData.data.price;
      }
    }

    // --------------------------------------------------------
    // Return normalized information.
    // --------------------------------------------------------

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

      raw: symbolInfo,
    };
  }
}

module.exports = MarketData;