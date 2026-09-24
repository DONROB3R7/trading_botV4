import {
useEffect,
useState,
} from "react";

import {
getTradingSymbols,
getBots,
createBot,
pauseBot,
resumeBot,
deleteBot,
} from "../api";

import "./BotManagement.css";

function BotManagement() {
const [
symbols,
setSymbols,
] = useState([]);

const [
bots,
setBots,
] = useState([]);

const [
loading,
setLoading,
] = useState(true);

const [
creating,
setCreating,
] = useState(false);

const [
deletingBotId,
setDeletingBotId,
] = useState("");

const [
actionBotId,
setActionBotId,
] = useState("");

const [
botName,
setBotName,
] = useState("");

const [
symbol,
setSymbol,
] = useState("");

const [
direction,
setDirection,
] = useState("LONG");

const [
stopLoss,
setStopLoss,
] = useState("3");

const [
takeProfit,
setTakeProfit,
] = useState("5");

// ============================================================
// PYRAMID POSITIONS
// ============================================================

const [
pyramidPositions,
setPyramidPositions,
] = useState("1");

const [
message,
setMessage,
] = useState("");

const [
error,
setError,
] = useState("");

// ============================================================
// LOAD DATA
// ============================================================

async function loadData() {
try {
setLoading(true);
setError("");


  const [
    symbolsResult,
    botsResult,
  ] = await Promise.all([
    getTradingSymbols(),
    getBots(),
  ]);

  const loadedSymbols =
    Array.isArray(
      symbolsResult?.data
    )
      ? symbolsResult.data
      : [];

  const loadedBots =
    Array.isArray(
      botsResult?.data
    )
      ? botsResult.data
      : [];

  setSymbols(
    loadedSymbols
  );

  setBots(
    loadedBots
  );

  if (
    loadedSymbols.length >
      0 &&
    !symbol
  ) {
    setSymbol(
      loadedSymbols[0]
    );
  }
} catch (err) {
  console.error(
    "[Bot Management] Load error:",
    err
  );

  setError(
    err.message
  );
} finally {
  setLoading(false);
}


}

useEffect(() => {
loadData();
}, []);

// ============================================================
// CREATE BOT
// ============================================================

async function handleCreateBot(
event
) {
event.preventDefault();


setMessage("");
setError("");

const cleanName =
  String(
    botName || ""
  ).trim();

if (!cleanName) {
  setError(
    "Please enter a bot name."
  );

  return;
}

if (!symbol) {
  setError(
    "Please select a trading coin."
  );

  return;
}

if (
  direction !== "LONG" &&
  direction !== "SHORT"
) {
  setError(
    "Please select LONG or SHORT."
  );

  return;
}

const sl =
  Number(
    stopLoss
  );

const tp =
  Number(
    takeProfit
  );

const pyramid =
  Number(
    pyramidPositions
  );

if (
  !Number.isFinite(sl) ||
  sl <= 0
) {
  setError(
    "Stop Loss must be greater than 0."
  );

  return;
}

if (
  !Number.isFinite(tp) ||
  tp <= 0
) {
  setError(
    "Take Profit must be greater than 0."
  );

  return;
}

if (
  !Number.isInteger(
    pyramid
  ) ||
  pyramid < 1 ||
  pyramid > 10
) {
  setError(
    "Pyramid Positions must be a whole number between 1 and 10."
  );

  return;
}

try {
  setCreating(true);

  const result =
    await createBot({
      name:
        cleanName,

      symbol,

      direction,

      entryModel:
        "BUTTON_PRESS",

      stopLoss:
        sl,

      takeProfit:
        tp,

      // ----------------------------------------------------
      // Maximum TOTAL positions for this bot.
      // 1 = no pyramid.
      // 2 = first entry + one pyramid.
      // 3 = first entry + two pyramids.
      // ----------------------------------------------------

      pyramidPositions:
        pyramid,
    });

  const newBot =
    result?.data;

  if (newBot) {
    setBots(
      (currentBots) => [
        ...currentBots,
        newBot,
      ]
    );
  } else {
    await loadData();
  }

  setBotName("");
  setDirection("LONG");
  setStopLoss("3");
  setTakeProfit("5");
  setPyramidPositions("1");

  setMessage(
    "Bot created successfully."
  );
} catch (err) {
  console.error(
    "[Bot Management] Error:",
    err
  );

  setError(
    err.message
  );
} finally {
  setCreating(false);
}


}

// ============================================================
// PAUSE / RESUME
// ============================================================

async function handleToggleBot(
bot
) {
try {
setActionBotId(
bot.id
);


  setMessage("");
  setError("");

  if (
    bot.status ===
    "ACTIVE"
  ) {
    await pauseBot(
      bot.id
    );
  } else {
    await resumeBot(
      bot.id
    );
  }

  setBots(
    (currentBots) =>
      currentBots.map(
        (item) =>
          item.id ===
          bot.id
            ? {
                ...item,

                status:
                  item.status ===
                  "ACTIVE"
                    ? "PAUSED"
                    : "ACTIVE",
              }
            : item
      )
  );
} catch (err) {
  console.error(
    "[Bot Management] Toggle error:",
    err
  );

  setError(
    err.message
  );
} finally {
  setActionBotId("");
}


}

// ============================================================
// DELETE BOT
// ============================================================

async function handleDeleteBot(
bot
) {
const confirmed =
window.confirm(
`Delete bot "${bot.name}"?`
);


if (!confirmed) {
  return;
}

try {
  setDeletingBotId(
    bot.id
  );

  setMessage("");
  setError("");

  await deleteBot(
    bot.id
  );

  setBots(
    (currentBots) =>
      currentBots.filter(
        (item) =>
          item.id !==
          bot.id
      )
  );

  setMessage(
    `"${bot.name}" deleted.`
  );
} catch (err) {
  console.error(
    "[Bot Management] Delete error:",
    err
  );

  setError(
    err.message
  );
} finally {
  setDeletingBotId("");
}


}

// ============================================================
// UI
// ============================================================

return ( <div className="bot-management-page">


  <div className="bot-management-header">
    <div>
      <h1>
        🤖 BOT MANAGEMENT
      </h1>

      <p>
        Create and control your trading bots.
      </p>
    </div>
  </div>

  {/* ======================================================
      CREATE BOT
      ====================================================== */}

  <div className="bot-create-card">

    <div className="bot-section-title">
      CREATE NEW BOT
    </div>

    <form
      onSubmit={
        handleCreateBot
      }
    >

      <div className="bot-form-grid">

        <div className="bot-form-group">
          <label>
            BOT NAME
          </label>

          <input
            type="text"
            value={
              botName
            }
            onChange={
              (event) =>
                setBotName(
                  event.target.value
                )
            }
            placeholder="My BTC Bot"
          />
        </div>

        <div className="bot-form-group">
          <label>
            TRADING COIN
          </label>

          <select
            value={
              symbol
            }
            onChange={
              (event) =>
                setSymbol(
                  event.target.value
                )
            }
            disabled={
              loading ||
              symbols.length ===
                0
            }
          >
            {loading && (
              <option>
                Loading...
              </option>
            )}

            {!loading &&
              symbols.length ===
                0 && (
                <option>
                  No symbols available
                </option>
              )}

            {symbols.map(
              (
                item
              ) => (
                <option
                  key={
                    item
                  }
                  value={
                    item
                  }
                >
                  {item}
                </option>
              )
            )}
          </select>
        </div>

        {/* ==================================================
            DIRECTION
            ================================================== */}

        <div className="bot-form-group">
          <label>
            DIRECTION
          </label>

          <select
            value={
              direction
            }
            onChange={
              (event) =>
                setDirection(
                  event.target.value
                )
            }
          >
            <option value="LONG">
              LONG
            </option>

            <option value="SHORT">
              SHORT
            </option>
          </select>
        </div>

        {/* ==================================================
            ENTRY MODEL
            ================================================== */}

        <div className="bot-form-group">
          <label>
            ENTRY MODEL
          </label>

          <div className="bot-static-field">
            Button Press
          </div>
        </div>

        {/* ==================================================
            STOP LOSS
            ================================================== */}

        <div className="bot-form-group">
          <label>
            STOP LOSS %
          </label>

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={
              stopLoss
            }
            onChange={
              (event) =>
                setStopLoss(
                  event.target.value
                )
            }
          />
        </div>

        {/* ==================================================
            TAKE PROFIT
            ================================================== */}

        <div className="bot-form-group">
          <label>
            TAKE PROFIT %
          </label>

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={
              takeProfit
            }
            onChange={
              (event) =>
                setTakeProfit(
                  event.target.value
                )
            }
          />
        </div>

        {/* ==================================================
            PYRAMID POSITIONS
            ================================================== */}

        <div className="bot-form-group">
          <label>
            PYRAMID POSITIONS
          </label>

          <input
            type="number"
            min="1"
            max="10"
            step="1"
            value={
              pyramidPositions
            }
            onChange={
              (event) =>
                setPyramidPositions(
                  event.target.value
                )
            }
          />

          <small>
            Maximum total entries for this bot.
          </small>
        </div>

      </div>

      <button
        type="submit"
        className="bot-create-button"
        disabled={
          creating
        }
      >
        {creating
          ? "CREATING..."
          : "CREATE BOT"}
      </button>

    </form>

    {message && (
      <div className="bot-success-message">
        {message}
      </div>
    )}

    {error && (
      <div className="bot-error-message">
        {error}
      </div>
    )}

  </div>

  {/* ======================================================
      BOT LIST
      ====================================================== */}

  <div className="bot-list-section">

    <div className="bot-section-title">
      YOUR BOTS
    </div>

    {bots.length ===
      0 && (
      <div className="bot-empty">
        No bots created yet.
      </div>
    )}

    <div className="bot-list">

      {bots.map(
        (bot) => (
          <div
            className="bot-card"
            key={
              bot.id
            }
          >

            <div className="bot-card-header">

              <div>
                <div className="bot-name">
                  {bot.name}
                </div>

                <div className="bot-symbol">
                  {bot.symbol}
                </div>
              </div>

              <div
                className={
                  bot.status ===
                  "ACTIVE"
                    ? "bot-status active"
                    : "bot-status paused"
                }
              >
                {bot.status}
              </div>

            </div>

            <div className="bot-card-info">

              <div>
                <span>
                  DIRECTION
                </span>

                <strong>
                  {bot.direction}
                </strong>
              </div>

              <div>
                <span>
                  ENTRY
                </span>

                <strong>
                  Button Press
                </strong>
              </div>

              <div>
                <span>
                  SL
                </span>

                <strong>
                  {bot.stopLoss}%
                </strong>
              </div>

              <div>
                <span>
                  TP
                </span>

                <strong>
                  {bot.takeProfit}%
                </strong>
              </div>

              <div>
                <span>
                  PYRAMID
                </span>

                <strong>
                  {bot.pyramidPositions ??
                    1}{" "}
                  POSITION
                  {(bot.pyramidPositions ??
                    1) !==
                  1
                    ? "S"
                    : ""}
                </strong>
              </div>

            </div>

            <div className="bot-card-actions">

              <button
                type="button"
                className="bot-toggle-button"
                onClick={() =>
                  handleToggleBot(
                    bot
                  )
                }
                disabled={
                  actionBotId ===
                    bot.id ||
                  deletingBotId ===
                    bot.id
                }
              >
                {actionBotId ===
                bot.id
                  ? "WORKING..."
                  : bot.status ===
                    "ACTIVE"
                  ? "PAUSE"
                  : "RESUME"}
              </button>

              <button
                type="button"
                className="bot-delete-button"
                onClick={() =>
                  handleDeleteBot(
                    bot
                  )
                }
                disabled={
                  deletingBotId ===
                    bot.id ||
                  actionBotId ===
                    bot.id
                }
              >
                {deletingBotId ===
                bot.id
                  ? "DELETING..."
                  : "DELETE"}
              </button>

            </div>

          </div>
        )
      )}

    </div>

  </div>

</div>


);
}

export default BotManagement;
