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
    return this.client.get(
      "/capi/v3/account/position/allPosition"
    );
  }

  // ==========================================================
  // SERVER COMPATIBILITY
  // ==========================================================

  async getAll() {
    return this.getAllPositions();
  }

  // ==========================================================
  // FIND SYMBOL
  // ==========================================================

  async getPosition(symbol) {
    const result =
      await this.getAllPositions();

    const positions =
      Array.isArray(result.data)
        ? result.data
        : [];

    if (!symbol) {
      return positions;
    }

    const target =
      String(symbol).toUpperCase();

    return positions.filter(
      (position) =>
        String(
          position.symbol ||
          ""
        ).toUpperCase() === target
    );
  }
}

module.exports = PositionService;