

const API_BASE_URL =
  "http://localhost:3001";

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
// POLUSDT INFO
// ============================================================

export async function getPolusdt() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/test/polusdt`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        "POLUSDT request failed"
    );
  }

  return data;
}

// ============================================================
// POLUSDT LONG
// ============================================================

export async function openPolusdtLong() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/test/polusdt/long`,
      {
        method:
          "POST",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        "POLUSDT LONG failed"
    );
  }

  return data;
}

// ============================================================
// POLUSDT SHORT
// ============================================================

export async function openPolusdtShort() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/test/polusdt/short`,
      {
        method:
          "POST",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        "POLUSDT SHORT failed"
    );
  }

  return data;
}

// ============================================================
// POLUSDT CLOSE
// ============================================================

export async function closePolusdt() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/test/polusdt/close`,
      {
        method:
          "POST",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        "POLUSDT CLOSE failed"
    );
  }

  return data;
}

// ============================================================
// POLUSDT TP / SL
// ============================================================

export async function updatePolusdtTpSl(
  stopLoss,
  takeProfit
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/test/polusdt/tpsl`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
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
        "POLUSDT TP/SL failed"
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
  symbol
) {
  const normalizedSymbol =
    String(
      symbol
    )
      .toUpperCase()
      .trim();

  const response =
    await fetch(
      `${API_BASE_URL}/api/chart/${normalizedSymbol}`
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
// GET BOTS
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
// CREATE BOT
// ============================================================

export async function createBot(
  bot
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
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
// ENTER BOT POSITION
// ============================================================

export async function enterBot(
  botId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots/${botId}/enter`,
      {
        method:
          "POST",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        "Bot entry failed"
    );
  }

  return data;
}

// ============================================================
// CLOSE BOT POSITION
// ============================================================

export async function closeBot(
  botId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots/${botId}/close`,
      {
        method:
          "POST",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        "Bot close failed"
    );
  }

  return data;
}

// ============================================================
// PAUSE BOT
// ============================================================

export async function pauseBot(
  botId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots/${botId}/pause`,
      {
        method:
          "POST",
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
// RESUME BOT
// ============================================================

export async function resumeBot(
  botId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots/${botId}/resume`,
      {
        method:
          "POST",
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
// DELETE BOT
// ============================================================

export async function deleteBot(
  botId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/bots/${botId}`,
      {
        method:
          "DELETE",
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