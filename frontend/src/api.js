const API_BASE_URL = "http://localhost:3001";

// ============================================================
// HEALTH
// ============================================================

export async function getHealth() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/health`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Health request failed"
    );
  }

  return data;
}

// ============================================================
// BOTS
// ============================================================

export async function getBots() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Bots request failed"
    );
  }

  return data;
}

// ============================================================
// ENTRY MODEL
// ============================================================

export async function scanEntryModel(
  symbol,
  botDirection,
  triggerState
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/entry-models/orderbook/scan`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          symbol,
          botDirection,
          triggerState,
        }),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Entry Model scan failed"
    );
  }

  return data;
}

// ============================================================
// ENTRY MODEL ENGINE
// ============================================================

export async function startEntryModelEngine(
  botId,
  symbol,
  botDirection,
  triggerState
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/entry-models/engine/start`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          botId,
          symbol,
          botDirection,
          triggerState,
        }),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Start Entry Model engine failed"
    );
  }

  return data;
}

export async function updateEntryModelEngine(
  botId,
  symbol,
  botDirection,
  triggerState
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/entry-models/engine/update`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          botId,
          symbol,
          botDirection,
          triggerState,
        }),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Update Entry Model engine failed"
    );
  }

  return data;
}

export async function stopEntryModelEngine(
  botId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/entry-models/engine/stop`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          botId,
        }),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Stop Entry Model engine failed"
    );
  }

  return data;
}

export async function getEntryModelEngine(
  botId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/entry-models/engine/${encodeURIComponent(
        botId
      )}`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Get Entry Model engine failed"
    );
  }

  return data;
}

export async function getEntryModelEngines() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/entry-models/engines`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Get Entry Model engines failed"
    );
  }

  return data;
}

// ============================================================
// BOT MANAGEMENT — ENTRY MODEL START
// ============================================================

export async function startEntryModel(
  botId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots/${encodeURIComponent(
        botId
      )}/entry-model/start`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
      "Failed to start Entry Model."
    );
  }

  return data;
}

// ============================================================
// BOT MANAGEMENT — ENTRY MODEL STOP
// ============================================================

export async function stopEntryModel(
  botId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots/${encodeURIComponent(
        botId
      )}/entry-model/stop`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
      "Failed to stop Entry Model."
    );
  }

  return data;
}

// ============================================================
// ACCOUNT
// ============================================================

export async function getAccount() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/weex/account`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Account request failed"
    );
  }

  return data;
}

// ============================================================
// ACCOUNT CONFIG
// ============================================================

export async function getAccountConfig() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/weex/account-config`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Account config request failed"
    );
  }

  return data;
}

// ============================================================
// POSITIONS
// ============================================================

export async function getPositions() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/weex/positions`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Positions request failed"
    );
  }

  return data;
}

// ============================================================
// TRADING SYMBOLS
// ============================================================

export async function getTradingSymbols() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/weex/trading-symbols`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Trading symbols request failed"
    );
  }

  return data;
}

// ============================================================
// CHART
// ============================================================

export async function getChart(
  symbol,
  interval = "1m"
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/chart/${encodeURIComponent(
        symbol
      )}?interval=${encodeURIComponent(
        interval
      )}`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Chart request failed"
    );
  }

  return data;
}

// ============================================================
// BOT CREATE
// ============================================================

export async function createBot(
  bot
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          bot
        ),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Create bot failed"
    );
  }

  return data;
}

// ============================================================
// BOT ENTER
// ============================================================

export async function enterBot(
  botId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots/${encodeURIComponent(
        botId
      )}/enter`,
      {
        method: "POST",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Enter bot failed"
    );
  }

  return data;
}

// ============================================================
// BOT CLOSE
// ============================================================

export async function closeBot(
  botId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots/${encodeURIComponent(
        botId
      )}/close`,
      {
        method: "POST",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Close bot failed"
    );
  }

  return data;
}

// ============================================================
// BOT PAUSE
// ============================================================

export async function pauseBot(
  botId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots/${encodeURIComponent(
        botId
      )}/pause`,
      {
        method: "POST",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Pause bot failed"
    );
  }

  return data;
}

// ============================================================
// BOT RESUME
// ============================================================

export async function resumeBot(
  botId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots/${encodeURIComponent(
        botId
      )}/resume`,
      {
        method: "POST",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Resume bot failed"
    );
  }

  return data;
}

// ============================================================
// BOT DELETE
// ============================================================

export async function deleteBot(
  botId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots/${encodeURIComponent(
        botId
      )}`,
      {
        method: "DELETE",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Delete bot failed"
    );
  }

  return data;
}

// ============================================================
// TEST POLUSDT
// ============================================================

export async function testPolusdt() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/test/polusdt`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "POLUSDT test failed"
    );
  }

  return data;
}

export async function testPolusdtLong() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/test/polusdt/long`,
      {
        method: "POST",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "POLUSDT LONG test failed"
    );
  }

  return data;
}

export async function testPolusdtShort() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/test/polusdt/short`,
      {
        method: "POST",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "POLUSDT SHORT test failed"
    );
  }

  return data;
}

export async function testPolusdtClose() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/test/polusdt/close`,
      {
        method: "POST",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "POLUSDT CLOSE test failed"
    );
  }

  return data;
}

export async function testPolusdtTpSl(
  stopLoss,
  takeProfit
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/test/polusdt/tpsl`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          stopLoss,
          takeProfit,
        }),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "POLUSDT TP/SL test failed"
    );
  }

  return data;
}

// ============================================================
// POLUSDT TRADE ALIASES
// ============================================================

export async function openPolusdtLong() {
  return testPolusdtLong();
}

export async function openPolusdtShort() {
  return testPolusdtShort();
}

export async function closePolusdt() {
  return testPolusdtClose();
}

export async function updatePolusdtTpSl(
  stopLoss,
  takeProfit
) {
  return testPolusdtTpSl(
    stopLoss,
    takeProfit
  );
}
