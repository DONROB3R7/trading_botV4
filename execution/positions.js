const WeexClient = require("./weexClient");

// ============================================================
// POSITION SERVICE
// ============================================================

class PositionService {
  constructor(client = null) {
    this.client =
      client ||
      new WeexClient();
  }

  // ==========================================================
  // ALL POSITIONS
  // ==========================================================

  async getAllPositions() {
    const result =
      await this.client.get(
        "/capi/v3/account/position/allPosition"
      );

    // WEEX V3 normally returns the array directly.
    // Keep compatibility with wrapped responses too.
    if (Array.isArray(result)) {
      return result;
    }

    if (Array.isArray(result?.data)) {
      return result.data;
    }

    if (Array.isArray(result?.data?.positions)) {
      return result.data.positions;
    }

    if (Array.isArray(result?.positions)) {
      return result.positions;
    }

    return [];
  }

  // ==========================================================
  // SERVER COMPATIBILITY
  // ==========================================================

  async getAll() {
    return this.getAllPositions();
  }

  // ==========================================================
  // MARK PRICE
  // ==========================================================

  async getMarkPrice(symbol) {
    if (!symbol) {
      return null;
    }

    const result =
      await this.client.get(
        "/capi/v3/market/symbolPrice",
        {
          symbol,
          priceType: "MARK",
        }
      );

    // WEEX V3 response:
    // {
    //   symbol: "BTCUSDT",
    //   price: "69348.5",
    //   time: ...
    // }

    const price =
      result?.price ??
      result?.data?.price ??
      result?.markPrice ??
      result?.data?.markPrice ??
      null;

    const numericPrice =
      Number(price);

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      return null;
    }

    return numericPrice;
  }

  // ==========================================================
  // ENRICH POSITION
  // ==========================================================

  async enrichPosition(position) {
    if (!position) {
      return null;
    }

    const size =
      Number(
        position.size ??
        position.positionSize ??
        position.qty ??
        position.quantity ??
        0
      );

    const openValue =
      Number(
        position.openValue ??
        position.open_value ??
        0
      );

    let averageEntryPrice = null;

    // WEEX:
    // average entry = openValue / size
    if (
      Number.isFinite(openValue) &&
      openValue > 0 &&
      Number.isFinite(size) &&
      size > 0
    ) {
      averageEntryPrice =
        openValue / size;
    }

    const currentPrice =
      await this.getMarkPrice(
        position.symbol
      );

    return {
      ...position,

      // Normalized fields for BotEntry
      averageEntryPrice,
      avgEntryPrice:
        averageEntryPrice,

      currentPrice,
      markPrice:
        currentPrice,
    };
  }

  // ==========================================================
  // FIND SYMBOL
  // ==========================================================

  async getPosition(symbol) {
    const positions =
      await this.getAllPositions();

    if (!symbol) {
      return positions;
    }

    const target =
      String(symbol).toUpperCase();

    const matches =
      positions.filter(
        (position) =>
          String(
            position?.symbol ||
            ""
          ).toUpperCase() === target
      );

    // Enrich only matching symbol.
    const enriched =
      await Promise.all(
        matches.map(
          (position) =>
            this.enrichPosition(position)
        )
      );

    return enriched;
  }
}

module.exports = PositionService;