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
      "Failed to load health."
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
      "Failed to load account."
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
      "Failed to load account config."
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
      "Failed to load positions."
    );
  }

  return data;
}

// ============================================================
// POLUSDT MARKET INFO
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
      "Failed to load POLUSDT."
    );
  }

  return data;
}

// ============================================================
// OPEN POLUSDT LONG
// ============================================================

export async function openPolusdtLong() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/test/polusdt/long`,
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
      data.error ||
      "Failed to open POLUSDT LONG."
    );
  }

  return data;
}

// ============================================================
// OPEN POLUSDT SHORT
// ============================================================

export async function openPolusdtShort() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/test/polusdt/short`,
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
      data.error ||
      "Failed to open POLUSDT SHORT."
    );
  }

  return data;
}

// ============================================================
// CLOSE POLUSDT
// ============================================================

export async function closePolusdt() {
  const response =
    await fetch(
      `${API_BASE_URL}/api/test/polusdt/close`,
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
      data.error ||
      "Failed to close POLUSDT."
    );
  }

  return data;
}

// ============================================================
// UPDATE POLUSDT TP / SL
// ============================================================

export async function updatePolusdtTpSl(
  slPercent,
  tpPercent
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
          slPercent,
          tpPercent,
        }),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Failed to update TP/SL."
    );
  }

  return data;
}