const tradeLifecycle =
  require("../lifecycle/tradeLifecycle");

class BotEntry {
  constructor() {
    console.log("[BotEntry] Initialized");
  }

  // ============================================================
  // FIND ACTIVE POSITION
  // ============================================================

  findActivePosition(positionData, direction) {
    if (!positionData) {
      return null;
    }

    const positions = Array.isArray(positionData)
      ? positionData
      : Array.isArray(positionData?.data)
      ? positionData.data
      : Array.isArray(positionData?.positions)
      ? positionData.positions
      : Array.isArray(positionData?.data?.positions)
      ? positionData.data.positions
      : [];

    if (positions.length === 0) {
      return null;
    }

    const wantedDirection =
      String(direction || "").toUpperCase();

    for (const position of positions) {
      if (!position) continue;

      const positionDirection = String(
        position.direction ||
        position.side ||
        position.positionSide ||
        position.holdSide ||
        ""
      ).toUpperCase();

      const quantity = Number(
        position.quantity ??
        position.qty ??
        position.size ??
        position.holdVol ??
        position.positionAmt ??
        0
      );

      if (quantity === 0) {
        continue;
      }

      if (
        positionDirection &&
        positionDirection !== wantedDirection &&
        positionDirection !==
          (wantedDirection === "LONG"
            ? "BUY"
            : "SELL")
      ) {
        continue;
      }

      return position;
    }

    return null;
  }

  // ============================================================
  // GET NUMBER FROM POSITION
  // ============================================================

  getPositionNumber(position, fields) {
    for (const field of fields) {
      if (
        position &&
        position[field] !== undefined &&
        position[field] !== null
      ) {
        const value = Number(position[field]);

        if (Number.isFinite(value) && value > 0) {
          return value;
        }
      }
    }

    return null;
  }

  // ============================================================
  // PYRAMID DISTANCE CHECK
  // ============================================================

  async checkPyramidDistance({
    bot,
    positions,
    tradeNumber,
  }) {
    // ==========================================================
    // ENTRY #1 IS ALWAYS ALLOWED
    // ==========================================================

    if (tradeNumber === 1) {
      return {
        allowed: true,
        reason: "FIRST_ENTRY",
      };
    }

    // ==========================================================
    // POSITION SERVICE CHECK
    // ==========================================================

    if (!positions) {
      console.error(
        `[BotEntry] PYRAMID DISTANCE ERROR | Bot=${bot.id} | Position service missing`
      );

      return {
        allowed: false,
        reason: "POSITION_SERVICE_MISSING",
      };
    }

    // ==========================================================
    // GET LIVE WEEX POSITION
    // ==========================================================

    let positionData;

    try {
      positionData =
        await positions.getPosition(bot.symbol);
    } catch (error) {
      console.error(
        `[BotEntry] PYRAMID DISTANCE ERROR | Bot=${bot.id} | ${error.message}`
      );

      return {
        allowed: false,
        reason: "POSITION_CHECK_FAILED",
      };
    }

    const position =
      this.findActivePosition(
        positionData,
        bot.direction
      );

    if (!position) {
      console.log(
        `[BotEntry] PYRAMID DISTANCE SKIP | Bot=${bot.id} | No active WEEX position found`
      );

      return {
        allowed: false,
        reason: "NO_ACTIVE_POSITION",
      };
    }

    // ==========================================================
    // AVG ENTRY PRICE
    // ==========================================================

    const averageEntryPrice =
      this.getPositionNumber(position, [
        "avgEntryPrice",
        "averageEntryPrice",
        "avgOpenPrice",
        "entryPrice",
        "openPrice",
      ]);

    // ==========================================================
    // CURRENT / MARK PRICE
    // ==========================================================

    const currentPrice =
      this.getPositionNumber(position, [
        "markPrice",
        "currentPrice",
        "lastPrice",
        "marketPrice",
        "indexPrice",
      ]);

    if (
      !averageEntryPrice ||
      !currentPrice
    ) {
      console.error(
        `[BotEntry] PYRAMID DISTANCE ERROR | ` +
        `Bot=${bot.id} | ` +
        `AvgEntry=${averageEntryPrice} | ` +
        `Current=${currentPrice}`
      );

      return {
        allowed: false,
        reason: "PRICE_DATA_MISSING",
      };
    }

    // ==========================================================
    // CALCULATE ADVERSE DISTANCE
    // ==========================================================

    let adverseDistance = 0;

    if (
      String(bot.direction).toUpperCase() ===
      "LONG"
    ) {
      // LONG:
      // We want price BELOW average entry.

      adverseDistance =
        (averageEntryPrice - currentPrice) /
        averageEntryPrice;
    }

    if (
      String(bot.direction).toUpperCase() ===
      "SHORT"
    ) {
      // SHORT:
      // We want price ABOVE average entry.

      adverseDistance =
        (currentPrice - averageEntryPrice) /
        averageEntryPrice;
    }

    // ==========================================================
    // PREVENT NEGATIVE DISTANCE
    // ==========================================================

    adverseDistance = Math.max(
      0,
      adverseDistance
    );

    // ==========================================================
    // BOT PYRAMID DISTANCE
    //
    // Bot stores percentage:
    //
    // 1    = 1%
    // 0.5  = 0.5%
    // 2    = 2%
    // 4    = 4%
    //
    // Internal calculation uses decimal:
    //
    // 1% = 0.01
    // 2% = 0.02
    // 4% = 0.04
    // ==========================================================

    const configuredDistance =
      Number(
        bot.pyramidDistance
      );

    const required =
      Number.isFinite(
        configuredDistance
      ) &&
      configuredDistance > 0
        ? configuredDistance / 100
        : 0.01;

    // ==========================================================
    // FINAL CHECK
    // ==========================================================

    const allowed =
      adverseDistance >= required;

    // ==========================================================
    // DEBUG LOG
    // ==========================================================

    console.log(
      `[BotEntry] PYRAMID DISTANCE | ` +
      `Bot=${bot.id} | ` +
      `Direction=${bot.direction} | ` +
      `AvgEntry=${averageEntryPrice} | ` +
      `Current=${currentPrice} | ` +
      `AdverseDistance=${(adverseDistance * 100).toFixed(2)}% | ` +
      `Configured=${Number.isFinite(configuredDistance) ? configuredDistance : 1}% | ` +
      `Required=${(required * 100).toFixed(2)}% | ` +
      `Allowed=${allowed}`
    );

    // ==========================================================
    // DISTANCE FAILED
    // ==========================================================

    if (!allowed) {
      return {
        allowed: false,
        reason: "PYRAMID_DISTANCE",
        averageEntryPrice,
        currentPrice,
        adverseDistance,
        requiredDistance: required,
      };
    }

    // ==========================================================
    // DISTANCE PASSED
    // ==========================================================

    return {
      allowed: true,
      reason: "PYRAMID_DISTANCE_PASSED",
      averageEntryPrice,
      currentPrice,
      adverseDistance,
      requiredDistance: required,
    };
  }

  // ============================================================
  // ENTER
  // ============================================================

  async enter({
    bot,
    orders,
    positions,
    advanced,
  }) {
    // ==========================================================
    // BASIC CHECKS
    // ==========================================================

    if (!bot) {
      return {
        ok: false,
        status: 404,
        error: "Bot not found",
      };
    }

    if (bot.status !== "ACTIVE") {
      return {
        ok: false,
        status: 400,
        error:
          `Bot is not ACTIVE | Status=${bot.status}`,
      };
    }

    // ==========================================================
    // TRIGGER CHECK
    // ==========================================================

    if (
      bot.triggerLineEnabled &&
      bot.triggerState !== "ARMED"
    ) {
      return {
        ok: false,
        status: 400,
        error:
          `Trigger not armed | State=${bot.triggerState}`,
      };
    }

    // ==========================================================
    // TP / SL TIMER
    // ==========================================================

    if (advanced.hasProtectionTimer(bot)) {
      return {
        ok: false,
        status: 400,
        error:
          "Previous entry protection is still processing",
      };
    }

    // ==========================================================
    // PYRAMID LIMIT
    // ==========================================================

    if (
      bot.currentPositionCount >=
      bot.maxPositions
    ) {
      return {
        ok: false,
        status: 400,
        error:
          `Maximum pyramid positions reached | ` +
          `Current=${bot.currentPositionCount} | ` +
          `Max=${bot.maxPositions}`,
      };
    }

    // ==========================================================
    // TRADE NUMBER
    // ==========================================================

    const tradeNumber =
      bot.currentPositionCount + 1;

    const isFirstEntry =
      tradeNumber === 1;

    console.log(
      `[BotEntry] ENTER | ` +
      `Bot=${bot.id} | ` +
      `Symbol=${bot.symbol} | ` +
      `Direction=${bot.direction} | ` +
      `Trade=${tradeNumber}/${bot.maxPositions} | ` +
      `PyramidDistance=${bot.pyramidDistance ?? 1}%`
    );

    // ==========================================================
    // PYRAMID DISTANCE CHECK
    //
    // AFTER:
    // Price Model
    //       ↓
    // Orderbook
    //       ↓
    // Entry signal
    //
    // BEFORE:
    // WEEX order
    // ==========================================================

    if (!isFirstEntry) {
      const distanceCheck =
        await this.checkPyramidDistance({
          bot,
          positions,
          tradeNumber,
        });

      if (!distanceCheck.allowed) {
        console.log(
          `[BotEntry] PYRAMID ENTRY SKIPPED | ` +
          `Bot=${bot.id} | ` +
          `Trade=${tradeNumber} | ` +
          `Reason=${distanceCheck.reason}`
        );

        return {
          ok: true,
          skipped: true,
          status: 200,
          result: {
            reason:
              distanceCheck.reason,

            tradeNumber,

            direction:
              bot.direction,

            averageEntryPrice:
              distanceCheck.averageEntryPrice ??
              null,

            currentPrice:
              distanceCheck.currentPrice ??
              null,

            adverseDistance:
              distanceCheck.adverseDistance ??
              null,

            requiredDistance:
              distanceCheck.requiredDistance ??
              0.01,
          },
        };
      }
    }

    // ==========================================================
    // OPEN WEEX POSITION
    // ==========================================================

    const openResult =
      await orders.openTestPosition(
        bot.symbol,
        bot.direction
      );

    // ==========================================================
    // CREATE TRADE RECORD
    // ==========================================================

    const trade = {
      tradeNumber,

      direction:
        bot.direction,

      openedAt:
        new Date().toISOString(),

      openResult,

      stopLoss:
        bot.stopLoss,

      takeProfit:
        bot.takeProfit,

      status:
        "OPEN",
    };

    // ==========================================================
    // UPDATE BOT STATE
    // ==========================================================

    bot.trades.push(
      trade
    );

    bot.currentPositionCount +=
      1;

    // ==========================================================
    // START TRADE LIFECYCLE
    //
    // ONLY ENTRY #1 STARTS THE LIFECYCLE.
    // ==========================================================

    if (isFirstEntry) {
      tradeLifecycle.start(
        bot
      );
    }

    // ==========================================================
    // SCHEDULE TP / SL PROTECTION
    // ==========================================================

    advanced.scheduleProtection({
      bot,
      orders,
      positions,
      openResult,
      trade,
      tradeNumber,
      isFirstEntry,
    });

    // ==========================================================
    // SUCCESS
    // ==========================================================

    console.log(
      `[BotEntry] OPENED | ` +
      `Bot=${bot.id} | ` +
      `Trade=${tradeNumber} | ` +
      `Positions=${bot.currentPositionCount}`
    );

    return {
      ok: true,
      status: 200,
      result: {
        bot,
        trade,
        openResult,
      },
    };
  }
}

module.exports =
  BotEntry;