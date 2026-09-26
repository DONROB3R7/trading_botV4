// ============================================================
// TRADE LIFECYCLE MONITOR
// ============================================================
//
// ONE monitor per bot.
//
// OPEN POSITION
//      ↓
// monitor WEEX
//      ↓
// position active
//      ↓
// WEEX becomes FLAT
//      ↓
// get final realized P/L
//      ↓
// PROFIT = RESET
// LOSS   = KILL
//
// This does NOT open trades.
// This does NOT manage TP/SL.
// This does NOT run Entry Model.
// ============================================================

class TradeLifecycle {

  constructor() {

    this.orders = null;
    this.positions = null;

    this.monitors =
      new Map();

    // TESTING
    // Check WEEX every 30 seconds.
    this.checkIntervalMs =
      30 * 1000;

    console.log(
      "[TradeLifecycle] Initialized"
    );
  }

  // ==========================================================
  // CONFIGURE SERVICES
  // ==========================================================

  configure({
    orders,
    positions,
  }) {

    this.orders =
      orders;

    this.positions =
      positions;

    console.log(
      "[TradeLifecycle] Services configured"
    );
  }

  // ==========================================================
  // START MONITOR
  // ==========================================================

  start(bot) {

    if (!bot || !bot.id) {

      throw new Error(
        "TradeLifecycle.start requires bot"
      );

    }

    if (
      !this.orders ||
      !this.positions
    ) {

      throw new Error(
        "TradeLifecycle services are not configured"
      );

    }

    if (
      this.monitors.has(
        bot.id
      )
    ) {

      console.log(
        `[TradeLifecycle] Already monitoring | ` +
        `Bot=${bot.id}`
      );

      return;
    }

    const monitor = {

      botId:
        bot.id,

      symbol:
        String(
          bot.symbol || ""
        ).toUpperCase(),

      direction:
        String(
          bot.direction || ""
        ).toUpperCase(),

      startedAt:
        Date.now(),

      wasPositionSeen:
        false,

      checking:
        false,

      timer:
        null,

      finalized:
        false,
    };

    monitor.timer =
      setInterval(
        () => {

          this.check(
            bot.id
          );

        },
        this.checkIntervalMs
      );

    this.monitors.set(
      bot.id,
      monitor
    );

    console.log(
      `[TradeLifecycle] START | ` +
      `Bot=${bot.id} | ` +
      `${monitor.symbol} | ` +
      `${monitor.direction}`
    );

    // Immediate check.
    this.check(
      bot.id
    );
  }

  // ==========================================================
  // STOP MONITOR
  // ==========================================================

  stop(botId) {

    const monitor =
      this.monitors.get(
        botId
      );

    if (!monitor) {
      return;
    }

    if (monitor.timer) {

      clearInterval(
        monitor.timer
      );

    }

    this.monitors.delete(
      botId
    );

    console.log(
      `[TradeLifecycle] STOP | ` +
      `Bot=${botId}`
    );
  }

  // ==========================================================
  // CHECK LIVE POSITION
  // ==========================================================

  async check(botId) {

    const monitor =
      this.monitors.get(
        botId
      );

    if (!monitor) {
      return;
    }

    if (monitor.checking) {
      return;
    }

    if (monitor.finalized) {
      return;
    }

    monitor.checking =
      true;

    try {

      const positions =
        await this.positions.getPosition(
          monitor.symbol
        );

      // ======================================================
      // DEBUG WEEX RESPONSE
      // ======================================================

      console.log(
        `[TradeLifecycle] WEEX POSITION CHECK | ` +
        `Bot=${botId} | ` +
        `${monitor.symbol} | ` +
        `Positions=${Array.isArray(positions) ? positions.length : 0}`
      );

      const position =
        this.findActivePosition(
          positions,
          monitor.direction
        );

      // ======================================================
      // POSITION ACTIVE
      // ======================================================

      if (position) {

        const qty =
          this.getPositionQuantity(
            position
          );

        console.log(
          `[TradeLifecycle] ACTIVE POSITION | ` +
          `Bot=${botId} | ` +
          `${monitor.symbol} | ` +
          `Side=${position.positionSide || position.side || "UNKNOWN"} | ` +
          `Qty=${qty}`
        );

        if (
          Math.abs(qty) > 0
        ) {

          if (
            !monitor.wasPositionSeen
          ) {

            monitor.wasPositionSeen =
              true;

            console.log(
              `[TradeLifecycle] POSITION DETECTED | ` +
              `Bot=${botId} | ` +
              `${monitor.symbol} | ` +
              `Qty=${qty}`
            );

          }

          return;
        }
      }

      // ======================================================
      // FLAT
      // ======================================================

      if (
        !monitor.wasPositionSeen
      ) {

        console.log(
          `[TradeLifecycle] NO POSITION SEEN YET | ` +
          `Bot=${botId} | ` +
          `${monitor.symbol}`
        );

        return;
      }

      console.log(
        `[TradeLifecycle] POSITION FLAT | ` +
        `Bot=${botId} | ` +
        `${monitor.symbol}`
      );

      await this.finalize(
        botId,
        monitor
      );

    } catch (error) {

      console.error(
        `[TradeLifecycle] CHECK ERROR | ` +
        `Bot=${botId} | ` +
        `${error.message}`
      );

    } finally {

      monitor.checking =
        false;

    }
  }

  // ==========================================================
  // POSITION QUANTITY
  // ==========================================================

  getPositionQuantity(
    position
  ) {

    if (!position) {
      return 0;
    }

    const fields = [
      "total",
      "positionAmt",
      "qty",
      "quantity",
      "size",
      "positionSize",
      "holdVol",
    ];

    for (
      const field of fields
    ) {

      if (
        position[field] ===
        undefined ||
        position[field] ===
        null ||
        position[field] ===
        ""
      ) {

        continue;
      }

      const value =
        Number(
          position[field]
        );

      if (
        Number.isFinite(value) &&
        value !== 0
      ) {

        return value;
      }

    }

    return 0;
  }

  // ==========================================================
  // FIND ACTIVE POSITION
  // ==========================================================

  findActivePosition(
    positions,
    direction
  ) {

    if (
      !Array.isArray(
        positions
      )
    ) {

      return null;
    }

    const targetDirection =
      String(
        direction || ""
      ).toUpperCase();

    for (
      const position of positions
    ) {

      const side =
        String(
          position.positionSide ||
          position.side ||
          ""
        ).toUpperCase();

      const qty =
        this.getPositionQuantity(
          position
        );

      // Ignore genuinely flat positions.
      if (
        Math.abs(qty) <= 0
      ) {

        continue;
      }

      // Match LONG / SHORT when WEEX supplies it.
      if (
        !targetDirection ||
        side === targetDirection
      ) {

        return position;
      }

    }

    return null;
  }

  // ==========================================================
  // FINALIZE
  // ==========================================================

  async finalize(
    botId,
    monitor
  ) {

    if (
      monitor.finalized
    ) {

      return;
    }

    monitor.finalized =
      true;

    console.log(
      `[TradeLifecycle] FINALIZING | ` +
      `Bot=${botId} | ` +
      `${monitor.symbol}`
    );

    try {

      const closedAt =
        Date.now();

      const trades =
        await this.orders.getUserTrades(
          monitor.symbol,
          monitor.startedAt,
          closedAt,
          100
        );

      // ------------------------------------------------------
      // CLOSE SIDE
      //
      // LONG  -> SELL
      // SHORT -> BUY
      // ------------------------------------------------------

      const closeSide =
        monitor.direction === "LONG"
          ? "SELL"
          : "BUY";

      const cycleTrades =
        trades.filter(
          (trade) => {

            const tradeTime =
              Number(
                trade.time || 0
              );

            const tradeSide =
              String(
                trade.side || ""
              ).toUpperCase();

            const tradePositionSide =
              String(
                trade.positionSide || ""
              ).toUpperCase();

            return (

              tradeTime >=
                monitor.startedAt &&

              tradeTime <=
                closedAt &&

              tradeSide ===
                closeSide &&

              (
                !tradePositionSide ||
                tradePositionSide ===
                  monitor.direction
              )

            );

          }
        );

      const finalPnl =
        cycleTrades.reduce(
          (
            total,
            trade
          ) => {

            return (
              total +
              Number(
                trade.realizedPnl || 0
              )
            );

          },
          0
        );

      console.log(
        `[TradeLifecycle] FINAL P/L | ` +
        `Bot=${botId} | ` +
        `${monitor.symbol} | ` +
        `P/L=${finalPnl} | ` +
        `CloseFills=${cycleTrades.length}`
      );

      // ======================================================
      // PROFIT
      // ======================================================

      if (
        finalPnl > 0
      ) {

        console.log(
          `[TradeLifecycle] PROFIT | ` +
          `Bot=${botId} | ` +
          `P/L=${finalPnl}`
        );

        const bot =
          this.getBot(botId);

        if (
          bot &&
          typeof bot.onTradeProfit ===
            "function"
        ) {

          await bot.onTradeProfit(
            finalPnl
          );

        }

        return;
      }

      // ======================================================
      // LOSS
      // ======================================================

      if (
        finalPnl < 0
      ) {

        console.log(
          `[TradeLifecycle] LOSS | ` +
          `Bot=${botId} | ` +
          `P/L=${finalPnl}`
        );

        const bot =
          this.getBot(botId);

        if (
          bot &&
          typeof bot.onTradeLoss ===
            "function"
        ) {

          await bot.onTradeLoss(
            finalPnl
          );

        }

        return;
      }

      // ======================================================
      // ZERO
      // ======================================================

      console.log(
        `[TradeLifecycle] ZERO P/L | ` +
        `Bot=${botId}`
      );

      const bot =
        this.getBot(botId);

      if (
        bot &&
        typeof bot.onTradeFlat ===
          "function"
      ) {

        await bot.onTradeFlat(
          finalPnl
        );

      }

    } catch (error) {

      console.error(
        `[TradeLifecycle] FINALIZE ERROR | ` +
        `Bot=${botId} | ` +
        `${error.message}`
      );

      monitor.finalized =
        false;

    }
  }

  // ==========================================================
  // BOT LOOKUP
  // ==========================================================

  getBot(botId) {

    if (
      !this.getBots
    ) {

      return null;
    }

    return this.getBots(
      botId
    );

  }

  // ==========================================================
  // CONNECT BOT LOOKUP
  // ==========================================================

  configureBotLookup(
    getBots
  ) {

    this.getBots =
      getBots;

  }
}

// ============================================================
// SINGLETON
// ============================================================

const tradeLifecycle =
  new TradeLifecycle();

module.exports =
  tradeLifecycle;
