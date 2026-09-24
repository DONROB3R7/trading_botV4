const WeexClient = require("./weexClient");

// ============================================================
// ACCOUNT SERVICE
// ============================================================

class AccountService {
  constructor(client = null) {
    this.client =
      client ||
      new WeexClient();
  }

  // ==========================================================
  // ACCOUNT BALANCE
  // ==========================================================

  async getBalance() {
    return this.client.get(
      "/capi/v3/account/balance"
    );
  }

  // ==========================================================
  // ACCOUNT CONFIG
  // ==========================================================

  async getConfig() {
    return this.client.get(
      "/capi/v3/account/accountConfig"
    );
  }

  // ==========================================================
  // ACCOUNT STATUS
  // ==========================================================

  async getAccountStatus() {
    const [
      balance,
      config,
    ] = await Promise.all([
      this.getBalance(),
      this.getConfig(),
    ]);

    return {
      balance,
      config,
    };
  }
}

module.exports = AccountService;