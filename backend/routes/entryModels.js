const express =
  require("express");

const orderbookModel =
  require("../entry-models/orderbookEntryModel");

const entryModelEngine =
  require("../entry-models/entryModelEngine");

function createEntryModelsRouter() {
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
  // Does NOT start the cycle engine.
  // ==========================================================

  router.post(
    "/orderbook/scan",
    async (req, res) => {
      try {
        const {
          symbol,
          botDirection,
          triggerState,
        } = req.body;

        if (!symbol) {
          return res.status(400).json({
            scanned: false,
            reason: "MISSING_SYMBOL",
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
            symbol,
            botDirection,
            triggerState,
          });
        }

        const result =
          await orderbookModel.scan(
            symbol,
            botDirection
          );

        return res.json({
          scanned: true,
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
  // ==========================================================

  router.post(
    "/engine/start",
    async (req, res) => {
      try {
        const {
          botId,
          symbol,
          direction,
          triggerState,
        } = req.body;

        if (!botId) {
          return res.status(400).json({
            error:
              "Missing botId.",
          });
        }

        if (!symbol) {
          return res.status(400).json({
            error:
              "Missing symbol.",
          });
        }

        const bot = {
          id:
            botId,

          symbol:
            symbol,

          direction:
            direction,

          triggerState:
            triggerState ||
            "ARMED",
        };

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
  // ==========================================================

  router.post(
    "/engine/update",
    (req, res) => {
      try {
        const {
          botId,
          symbol,
          direction,
          triggerState,
        } = req.body;

        if (!botId) {
          return res.status(400).json({
            error:
              "Missing botId.",
          });
        }

        const status =
          entryModelEngine.updateEngineBot({
            id:
              botId,

            symbol,

            direction,

            triggerState,
          });

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
        } = req.body;

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