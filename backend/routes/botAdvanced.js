const TP_SL_DELAY_MS =
  30 * 1000;

const TRIGGER_CHECK_MS =
  30 * 1000;

const WEEX_BASE_URL =
  process.env.WEEX_BASE_URL ||
  "https://api-contract.weex.com";

// ============================================================
// BOT ADVANCED
// ============================================================

class BotAdvanced {

  constructor() {

    // --------------------------------------------------------
    // ADVANCED TIMERS
    // --------------------------------------------------------

    this.botTimers =
      new Map();

    this.triggerTimers =
      new Map();

  }

  // ==========================================================
  // CLEAN STRING
  // ==========================================================

  cleanString(
    value,
    fallback = ""
  ) {

    if (
      value === undefined ||
      value === null
    ) {

      return fallback;

    }

    return String(
      value
    ).trim();

  }

  // ==========================================================
  // CLEAN NUMBER
  // ==========================================================

  cleanNumber(
    value,
    fallback = 0
  ) {

    const number =
      Number(value);

    if (
      !Number.isFinite(
        number
      )
    ) {

      return fallback;

    }

    return number;

  }

  // ==========================================================
  // CLEAN DIRECTION
  // ==========================================================

  cleanDirection(
    value
  ) {

    return String(
      value || "LONG"
    ).toUpperCase() === "SHORT"
      ? "SHORT"
      : "LONG";

  }

  // ==========================================================
  // TRIGGER LINE ENABLED
  // ==========================================================

  cleanTriggerLineEnabled(
    value
  ) {

    return value === true;

  }

  // ==========================================================
  // TRIGGER STATE
  // ==========================================================

  cleanTriggerState(
    value,
    enabled
  ) {

    if (!enabled) {

      return "ARMED";

    }

    return value === "ARMED"
      ? "ARMED"
      : "NEUTRAL";

  }

  // ==========================================================
  // PRICE EXTRACTION
  // ==========================================================

  extractPrice(
    result
  ) {

    if (
      result === undefined ||
      result === null
    ) {

      return null;

    }

    if (
      typeof result ===
      "number"
    ) {

      return Number.isFinite(
        result
      )
        ? result
        : null;

    }

    if (
      typeof result ===
      "string"
    ) {

      const number =
        Number(result);

      return Number.isFinite(
        number
      )
        ? number
        : null;

    }

    if (
      typeof result ===
      "object"
    ) {

      const candidates = [

        result.price,

        result.lastPrice,

        result.markPrice,

        result.indexPrice,

        result.data?.price,

        result.data?.lastPrice,

        result.data?.markPrice,

        result.data?.indexPrice,

      ];

      for (
        const candidate of
          candidates
      ) {

        const number =
          Number(candidate);

        if (
          Number.isFinite(
            number
          )
        ) {

          return number;

        }

      }

      if (
        Array.isArray(
          result.data
        )
      ) {

        for (
          const item of
            result.data
        ) {

          const number =
            this.extractPrice(
              item
            );

          if (
            Number.isFinite(
              number
            )
          ) {

            return number;

          }

        }

      }

      if (
        Array.isArray(
          result
        )
      ) {

        for (
          const item of
            result
        ) {

          const number =
            this.extractPrice(
              item
            );

          if (
            Number.isFinite(
              number
            )
          ) {

            return number;

          }

        }

      }

    }

    return null;

  }

  // ==========================================================
  // GET CURRENT WEEX PRICE
  // ==========================================================

  async getCurrentMarketPrice(
    symbol
  ) {

    const cleanSymbolValue =
      String(
        symbol || ""
      )
        .trim()
        .toUpperCase();

    if (!cleanSymbolValue) {

      throw new Error(
        "Missing symbol"
      );

    }

    const url =
      `${WEEX_BASE_URL}/capi/v3/market/symbolPrice` +
      `?symbol=${encodeURIComponent(cleanSymbolValue)}` +
      `&priceType=INDEX`;

    console.log(
      `[WEEX] GET ${url}`
    );

    const response =
      await fetch(url);

    if (!response.ok) {

      throw new Error(
        `WEEX symbolPrice HTTP ${response.status}`
      );

    }

    const data =
      await response.json();

    const price =
      this.extractPrice(
        data
      );

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {

      throw new Error(
        `Invalid WEEX symbolPrice response: ${JSON.stringify(data)}`
      );

    }

    return price;

  }

  // ==========================================================
  // TRIGGER TOUCH / CROSS CHECK
  // ==========================================================

  hasTriggerLineTouched(
    previousPrice,
    currentPrice,
    triggerPrice
  ) {

    if (
      !Number.isFinite(
        previousPrice
      ) ||
      !Number.isFinite(
        currentPrice
      ) ||
      !Number.isFinite(
        triggerPrice
      )
    ) {

      return false;

    }

    if (
      currentPrice ===
      triggerPrice
    ) {

      return true;

    }

    if (
      previousPrice ===
      triggerPrice
    ) {

      return true;

    }

    if (
      previousPrice <
        triggerPrice &&
      currentPrice >
        triggerPrice
    ) {

      return true;

    }

    if (
      previousPrice >
        triggerPrice &&
      currentPrice <
        triggerPrice
    ) {

      return true;

    }

    return false;

  }

  // ==========================================================
  // STOP TRIGGER MONITOR
  // ==========================================================

  stopTriggerMonitor(
    bot
  ) {

    if (!bot) {

      return;

    }

    const timer =
      this.triggerTimers.get(
        bot.id
      );

    if (timer) {

      clearInterval(
        timer
      );

      this.triggerTimers.delete(
        bot.id
      );

    }

  }

  // ==========================================================
  // START TRIGGER MONITOR
  // ==========================================================

  startTriggerMonitor(
    bot
  ) {

    if (!bot) {

      return;

    }

    if (
      bot.triggerLineEnabled !==
      true
    ) {

      return;

    }

    if (
      bot.triggerState ===
      "ARMED"
    ) {

      return;

    }

    this.stopTriggerMonitor(
      bot
    );

    console.log(
      `[Trigger:${bot.symbol}] ` +
      `Monitor started | ` +
      `Trigger=${bot.triggerLinePrice} | ` +
      `Baseline=${bot.triggerLastPrice}`
    );

    const timer =
      setInterval(
        async () => {

          try {

            if (
              bot.triggerLineEnabled !==
              true
            ) {

              this.stopTriggerMonitor(
                bot
              );

              return;

            }

            if (
              bot.triggerState ===
              "ARMED"
            ) {

              this.stopTriggerMonitor(
                bot
              );

              return;

            }

            const triggerPrice =
              Number(
                bot.triggerLinePrice
              );

            if (
              !Number.isFinite(
                triggerPrice
              ) ||
              triggerPrice <= 0
            ) {

              console.log(
                `[Trigger:${bot.symbol}] ` +
                `Invalid trigger price`
              );

              return;

            }

            let currentPrice;

            try {

              currentPrice =
                await this.getCurrentMarketPrice(
                  bot.symbol
                );

            } catch (
              error
            ) {

              console.log(
                `[Trigger:${bot.symbol}] ` +
                `Price fetch failed: ${error.message}`
              );

              return;

            }

            if (
              !Number.isFinite(
                currentPrice
              ) ||
              currentPrice <= 0
            ) {

              console.log(
                `[Trigger:${bot.symbol}] ` +
                `Invalid current price`
              );

              return;

            }

            const previousPrice =
              Number(
                bot.triggerLastPrice
              );

            console.log(
              `[Trigger:${bot.symbol}] ` +
              `Check | ` +
              `Previous=${previousPrice} | ` +
              `Current=${currentPrice} | ` +
              `Trigger=${triggerPrice}`
            );

            if (
              !Number.isFinite(
                previousPrice
              ) ||
              previousPrice <= 0
            ) {

              bot.triggerLastPrice =
                currentPrice;

              console.log(
                `[Trigger:${bot.symbol}] ` +
                `Baseline initialized=${currentPrice}`
              );

              return;

            }

            const touched =
              this.hasTriggerLineTouched(
                previousPrice,
                currentPrice,
                triggerPrice
              );

            if (touched) {

              bot.triggerState =
                "ARMED";

              bot.triggerArmedAt =
                new Date().toISOString();

              bot.triggerArmedPrice =
                currentPrice;

              bot.triggerLastPrice =
                currentPrice;

              console.log(
                `[Trigger:${bot.symbol}] ` +
                `TRIGGER ARMED | ` +
                `Previous=${previousPrice} | ` +
                `Current=${currentPrice} | ` +
                `Trigger=${triggerPrice}`
              );

              this.stopTriggerMonitor(
                bot
              );

              return;

            }

            bot.triggerLastPrice =
              currentPrice;

          } catch (
            error
          ) {

            console.error(
              `[Trigger:${bot.symbol}] ` +
              `Monitor error:`,
              error.message
            );

          }

        },
        TRIGGER_CHECK_MS
      );

    this.triggerTimers.set(
      bot.id,
      timer
    );

  }

  // ==========================================================
  // CANCEL TP/SL TIMER
  // ==========================================================

  cancelProtectionTimer(
    bot
  ) {

    if (!bot) {

      return false;

    }

    const timer =
      this.botTimers.get(
        bot.id
      );

    if (!timer) {

      return false;

    }

    clearTimeout(
      timer
    );

    this.botTimers.delete(
      bot.id
    );

    console.log(
      `[Protection:${bot.symbol}] ` +
      `TP/SL timer cancelled`
    );

    return true;

  }

  // ==========================================================
  // IS TP/SL TIMER ACTIVE?
  // ==========================================================

  hasProtectionTimer(
    bot
  ) {

    if (!bot) {

      return false;

    }

    return this.botTimers.has(
      bot.id
    );

  }

  // ==========================================================
  // SCHEDULE TP/SL PROTECTION
  // ==========================================================

  scheduleProtection({
    bot,
    orders,
    positions,
    openResult,
    trade,
    tradeNumber,
    isFirstEntry,
  }) {

    if (!bot) {

      throw new Error(
        "Missing bot"
      );

    }

    if (!orders) {

      throw new Error(
        "Missing orders service"
      );

    }

    if (!positions) {

      throw new Error(
        "Missing positions service"
      );

    }

    if (!trade) {

      throw new Error(
        "Missing trade"
      );

    }

    // --------------------------------------------------------
    // REMOVE OLD TIMER
    // --------------------------------------------------------

    this.cancelProtectionTimer(
      bot
    );

    console.log(
      `[Protection:${bot.symbol}] ` +
      `TP/SL sync scheduled in 30 seconds | ` +
      `Trade #${tradeNumber}`
    );

    const timer =
      setTimeout(
        async () => {

          try {

            console.log(
              `[Protection:${bot.symbol}] ` +
              `30s TP/SL sync START | ` +
              `Trade #${tradeNumber}`
            );

            // ==================================================
            // UPDATE TP/SL
            // ==================================================

            const tpSlResult =
              await orders.updateTestTpSl(
                bot.symbol,
                bot.stopLoss,
                bot.takeProfit,
                {
                  keepOriginalSl:
                    !isFirstEntry,

                  originalStopLoss:
                    bot.originalStopLoss,

                  previousTpOrderId:
                    bot.currentTpOrderId,
                }
              );

            console.log(
              `[Protection:${bot.symbol}] ` +
              `TP/SL sync result:`,
              tpSlResult
            );

            // ==================================================
            // GET LIVE POSITION
            // ==================================================

            let livePosition =
              null;

            try {

              const allPositions =
                await positions.getAll();

              if (
                Array.isArray(
                  allPositions
                )
              ) {

                livePosition =
                  allPositions.find(
                    (position) => {

                      const positionSymbol =
                        String(
                          position.symbol ||
                          position.contract ||
                          ""
                        ).toUpperCase();

                      return (
                        positionSymbol ===
                        bot.symbol
                      );

                    }
                  );

              }

            } catch (
              positionError
            ) {

              console.error(
                `[Protection:${bot.symbol}] ` +
                `Position sync failed:`,
                positionError.message
              );

            }

            // ==================================================
            // LIVE ENTRY PRICE
            // ==================================================

            const liveAverageEntry =
              livePosition
                ? this.cleanNumber(
                    livePosition.avgEntryPrice ??
                    livePosition.averageEntryPrice ??
                    livePosition.entryPrice,
                    0
                  )
                : 0;

            const liveEntryPrice =
              liveAverageEntry > 0
                ? liveAverageEntry
                : this.cleanNumber(
                    openResult?.entryPrice ??
                    openResult?.price ??
                    openResult?.data?.entryPrice ??
                    openResult?.data?.price,
                    0
                  );

            // ==================================================
            // FIRST ENTRY
            // ==================================================

            if (
              isFirstEntry
            ) {

              bot.firstEntryPrice =
                liveEntryPrice > 0
                  ? liveEntryPrice
                  : null;

              bot.originalStopLoss =
                bot.stopLoss;

            }

            // ==================================================
            // AVERAGE ENTRY
            // ==================================================

            bot.averageEntryPrice =
              liveEntryPrice > 0
                ? liveEntryPrice
                : bot.averageEntryPrice;

            // ==================================================
            // CURRENT TP
            // ==================================================

            bot.currentTakeProfit =
              bot.takeProfit;

            // ==================================================
            // TP ORDER ID
            // ==================================================

            if (
              tpSlResult &&
              tpSlResult.tpOrderId !==
                undefined &&
              tpSlResult.tpOrderId !==
                null
            ) {

              bot.currentTpOrderId =
                String(
                  tpSlResult.tpOrderId
                );

            }

            // ==================================================
            // UPDATE TRADE
            // ==================================================

            trade.entryPrice =
              bot.averageEntryPrice;

            trade.stopLoss =
              bot.originalStopLoss;

            trade.takeProfit =
              bot.currentTakeProfit;

            trade.tpOrderId =
              bot.currentTpOrderId;

            trade.protectionSyncedAt =
              new Date().toISOString();

            console.log(
              `[Protection:${bot.symbol}] ` +
              `TP/SL protection synced | ` +
              `Trade #${tradeNumber} | ` +
              `Entry=${bot.averageEntryPrice} | ` +
              `SL=${trade.stopLoss} | ` +
              `TP=${trade.takeProfit} | ` +
              `TPOrder=${trade.tpOrderId}`
            );

          } catch (
            error
          ) {

            console.error(
              `[Protection:${bot.symbol}] ` +
              `TP/SL sync ERROR:`,
              error
            );

          } finally {

            this.botTimers.delete(
              bot.id
            );

          }

        },
        TP_SL_DELAY_MS
      );

    this.botTimers.set(
      bot.id,
      timer
    );

  }

  // ==========================================================
  // STOP ALL ADVANCED TIMERS FOR BOT
  // ==========================================================

  stopAll(
    bot
  ) {

    if (!bot) {

      return;

    }

    this.stopTriggerMonitor(
      bot
    );

    this.cancelProtectionTimer(
      bot
    );

  }

}

// ============================================================
// EXPORT
// ============================================================

module.exports =
  BotAdvanced;