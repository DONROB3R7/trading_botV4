// ============================================================
// MASTER BOT BRIDGE
// ============================================================
//
// This file does NOT contain trading logic.
//
// It simply "presses" the existing Master Bot ENTER endpoint:
//
//     POST /api/bots/:id/enter
//
// The Master Bot remains responsible for:
// - direction
// - trigger
// - pyramid
// - order execution
// - TP/SL
// - position state
//
// Entry Model only decides:
//     LONG / SHORT / NEUTRAL
//
// NEUTRAL is never sent here.
// ============================================================

const DEFAULT_HOST =
  "127.0.0.1";

// ============================================================
// CREATE BRIDGE
// ============================================================

function createMasterBotBridge({
  port,
  host = DEFAULT_HOST,
} = {}) {

  const cleanPort =
    Number(port);

  if (
    !Number.isFinite(cleanPort) ||
    cleanPort <= 0
  ) {

    throw new Error(
      "Master Bot Bridge requires a valid backend port."
    );

  }

  const baseUrl =
    `http://${host}:${cleanPort}`;

  // ==========================================================
  // PRESS EXISTING MASTER BOT ENTER BUTTON
  // ==========================================================

  async function enterBot(
    botId
  ) {

    if (!botId) {

      throw new Error(
        "Master Bot Bridge requires botId."
      );

    }

    const url =
      `${baseUrl}/api/bots/` +
      `${encodeURIComponent(botId)}/enter`;

    console.log(
      `[MasterBotBridge] ENTER button pressed | ` +
      `Bot=${botId}`
    );

    const response =
      await fetch(
        url,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );

    let data = null;

    try {

      data =
        await response.json();

    } catch {

      data =
        null;

    }

    if (!response.ok) {

      const error =
        new Error(
          data?.error ||
          `Master Bot ENTER failed | HTTP ${response.status}`
        );

      error.statusCode =
        response.status;

      error.response =
        data;

      throw error;

    }

    console.log(
      `[MasterBotBridge] ENTER completed | ` +
      `Bot=${botId}`
    );

    return data;

  }

  // ==========================================================
  // PUBLIC API
  // ==========================================================

  return {

    enterBot,

  };

}

// ============================================================
// EXPORT
// ============================================================

module.exports =
  createMasterBotBridge;