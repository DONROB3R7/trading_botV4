// ============================================================
// BOT ENTRY MODEL LOGIC
// ============================================================

class BotEntryModel {

  constructor() {

    console.log(
      "[BotEntryModel] Initialized"
    );

  }

  // ==========================================================
  // START ENTRY MODEL
  // ==========================================================

  async start({
    bot,
    entryModelEngine,
  }) {

    // ========================================================
    // STATUS
    // ========================================================

    if (
      bot.status !==
      "ACTIVE"
    ) {

      const error =
        new Error(
          `Cannot start Entry Model while bot status is ${bot.status}.`
        );

      error.code =
        "BOT_NOT_ACTIVE";

      throw error;

    }

    // ========================================================
    // TRIGGER GATE
    // ========================================================

    if (
      bot.triggerLineEnabled ===
        true &&
      bot.triggerState !==
        "ARMED"
    ) {

      const error =
        new Error(
          "Cannot start Entry Model — Bot is not ARMED."
        );

      error.code =
        "TRIGGER_NOT_ARMED";

      error.triggerState =
        bot.triggerState;

      error.triggerLinePrice =
        bot.triggerLinePrice;

      throw error;

    }

    // ========================================================
    // POSITION GATE
    // ========================================================

    if (
      bot.currentPositionCount >
      0
    ) {

      const error =
        new Error(
          "Cannot start Entry Model while a position is open."
        );

      error.code =
        "POSITION_OPEN";

      error.currentPositionCount =
        bot.currentPositionCount;

      throw error;

    }

    // ========================================================
    // START
    // ========================================================

    console.log(
      `[Bot:${bot.symbol}] ` +
      `MANUAL ENTRY MODEL START`
    );

    await entryModelEngine.startEngine(
      bot
    );

    // ========================================================
    // RESULT
    // ========================================================

    return {

      success:
        true,

      message:
        "Entry Model started.",

      bot,

    };

  }

  // ==========================================================
  // STOP ENTRY MODEL
  // ==========================================================

  stop({
    bot,
    entryModelEngine,
  }) {

    console.log(
      `[Bot:${bot.symbol}] ` +
      `MANUAL ENTRY MODEL STOP`
    );

    entryModelEngine.stopEngine(
      bot.id
    );

    return {

      success:
        true,

      message:
        "Entry Model stopped.",

      bot,

    };

  }

}

module.exports =
  BotEntryModel;