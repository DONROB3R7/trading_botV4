const express =
  require("express");

const orderbookModel =
  require("../entry-models/orderbookEntryModel");

const entryModelEngine =
  require("../entry-models/entryModelEngine");

function createEntryModelsRouter({
  getBot,
} = {}) {

  const router =
    express.Router();

  // ==========================================================
  // HEALTH
  // ==========================================================

  router.get(
    "/health",
    (req, res) => {

      res.json({
        online: true,
        module: "Entry Model",
        models: [
          "orderbook",
        ],
        tradingEnabled: false,
      });

    }
  );

  // ==========================================================
  // SINGLE MANUAL SCAN
  //
  // Kept for testing.
  //
  // IMPORTANT:
  // React does NOT provide symbol/direction/trigger state.
  // The server gets the REAL bot from bots.js.
  //
  // Does NOT start the cycle engine.
  // ==========================================================

  router.post(
    "/orderbook/scan",
    async (req, res) => {

      try {

        const {
          botId,
        } = req.body || {};

        if (!botId) {

          return res.status(400).json({
            scanned: false,
            reason:
              "MISSING_BOT_ID",
          });

        }

        if (
          typeof getBot !==
          "function"
        ) {

          throw new Error(
            "Bot getter is not configured"
          );

        }

        // ------------------------------------------------------
        // GET REAL BOT FROM SERVER
        // ------------------------------------------------------

        const bot =
          getBot(botId);

        if (!bot) {

          return res.status(404).json({
            scanned: false,
            reason:
              "BOT_NOT_FOUND",
            botId,
          });

        }

        const symbol =
          bot.symbol;

        const botDirection =
          bot.direction;

        const triggerState =
          bot.triggerState;

        // ------------------------------------------------------
        // VALIDATE REAL BOT
        // ------------------------------------------------------

        if (!symbol) {

          return res.status(400).json({
            scanned: false,
            reason:
              "BOT_MISSING_SYMBOL",
            botId,
          });

        }

        if (
          botDirection !==
            "LONG" &&
          botDirection !==
            "SHORT"
        ) {

          return res.status(400).json({
            scanned: false,
            reason:
              "INVALID_BOT_DIRECTION",
            botId,
            botDirection,
          });

        }

        if (
          String(
            triggerState || ""
          ).toUpperCase() !==
          "ARMED"
        ) {

          return res.json({
            scanned: false,
            reason:
              "BOT_NOT_ARMED",
            botId,
            symbol,
            botDirection,
            triggerState,
          });

        }

        // ------------------------------------------------------
        // ORDERBOOK SCAN
        // ------------------------------------------------------

        const result =
          await orderbookModel.scan(
            symbol,
            botDirection
          );

        return res.json({

          scanned: true,

          botId,

          symbol,

          botDirection,

          result,

        });

      } catch (error) {

        console.error(
          "[Entry Model] Scan error:",
          error
        );

        return res.status(500).json({

          scanned: false,

          reason:
            error?.message ||
            "ENTRY_MODEL_SCAN_FAILED",

        });

      }

    }
  );

  // ==========================================================
  // START ENGINE
  //
  // React sends ONLY botId.
  //
  // Server gets:
  // symbol
  // direction
  // triggerState
  //
  // from the real bot.
  // ==========================================================

  router.post(
    "/engine/start",
    async (req, res) => {

      try {

        const {
          botId,
        } = req.body || {};

        if (!botId) {

          return res.status(400).json({
            success: false,
            error:
              "Missing botId.",
          });

        }

        if (
          typeof getBot !==
          "function"
        ) {

          throw new Error(
            "Bot getter is not configured"
          );

        }

        // ------------------------------------------------------
        // GET REAL BOT
        // ------------------------------------------------------

        const bot =
          getBot(botId);

        if (!bot) {

          return res.status(404).json({
            success: false,
            error:
              "Bot not found.",
          });

        }

        // ------------------------------------------------------
        // START ENGINE USING REAL BOT
        // ------------------------------------------------------

        const status =
          await entryModelEngine.startEngine(
            bot
          );

        return res.json({

          success: true,

          status,

        });

      } catch (error) {

        console.error(
          "[Entry Model] Engine start error:",
          error
        );

        return res.status(500).json({

          success: false,

          error:
            error?.message ||
            "ENGINE_START_FAILED",

        });

      }

    }
  );

  // ==========================================================
  // UPDATE ENGINE BOT
  //
  // React sends ONLY botId.
  //
  // Server refreshes engine from the REAL bot.
  // ==========================================================

  router.post(
    "/engine/update",
    (req, res) => {

      try {

        const {
          botId,
        } = req.body || {};

        if (!botId) {

          return res.status(400).json({
            success: false,
            error:
              "Missing botId.",
          });

        }

        if (
          typeof getBot !==
          "function"
        ) {

          throw new Error(
            "Bot getter is not configured"
          );

        }

        // ------------------------------------------------------
        // GET REAL BOT
        // ------------------------------------------------------

        const bot =
          getBot(botId);

        if (!bot) {

          return res.status(404).json({
            success: false,
            error:
              "Bot not found.",
          });

        }

        // ------------------------------------------------------
        // UPDATE ENGINE
        // ------------------------------------------------------

        const status =
          entryModelEngine.updateEngineBot(
            bot
          );

        return res.json({

          success: true,

          status,

        });

      } catch (error) {

        console.error(
          "[Entry Model] Engine update error:",
          error
        );

        return res.status(500).json({

          success: false,

          error:
            error?.message ||
            "ENGINE_UPDATE_FAILED",

        });

      }

    }
  );

  // ==========================================================
  // STOP ENGINE
  // ==========================================================

  router.post(
    "/engine/stop",
    (req, res) => {

      try {

        const {
          botId,
        } = req.body || {};

        if (!botId) {

          return res.status(400).json({
            error:
              "Missing botId.",
          });

        }

        const status =
          entryModelEngine.stopEngine(
            botId
          );

        return res.json({

          success: true,

          status,

        });

      } catch (error) {

        console.error(
          "[Entry Model] Engine stop error:",
          error
        );

        return res.status(500).json({

          success: false,

          error:
            error?.message ||
            "ENGINE_STOP_FAILED",

        });

      }

    }
  );

  // ==========================================================
  // GET ONE ENGINE
  // ==========================================================

  router.get(
    "/engine/:botId",
    (req, res) => {

      const status =
        entryModelEngine.getStatus(
          req.params.botId
        );

      if (!status) {

        return res.json({

          running: false,

          exists: false,

          botId:
            req.params.botId,

          cycleNumber: 0,

          scanCount: 0,

          cycleSize: 10,

          currentScans: [],

          previousCycles: [],

        });

      }

      return res.json({

        exists: true,

        ...status,

      });

    }
  );

  // ==========================================================
  // GET ALL ENGINES
  // ==========================================================

  router.get(
    "/engines",
    (req, res) => {

      return res.json({

        engines:
          entryModelEngine.getAllStatus(),

      });

    }
  );

  // ==========================================================
  // DELETE ENGINE
  // ==========================================================

  router.delete(
    "/engine/:botId",
    (req, res) => {

      const deleted =
        entryModelEngine.deleteEngine(
          req.params.botId
        );

      return res.json({

        success: true,

        deleted,

      });

    }
  );

  return router;
}

module.exports =
  createEntryModelsRouter;