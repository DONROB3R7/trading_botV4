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
  startEntryModel,
  stopEntryModel,
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
    entryModelActionBotId,
    setEntryModelActionBotId,
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

  // ============================================================
  // TRIGGER LINE
  // ============================================================

  const [
    triggerLineEnabled,
    setTriggerLineEnabled,
  ] = useState(false);

  const [
    triggerLinePrice,
    setTriggerLinePrice,
  ] = useState("");

  // ============================================================
  // MESSAGES
  // ============================================================

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

      // ========================================================
      // SYMBOLS
      // ========================================================

      const loadedSymbols =
        Array.isArray(
          symbolsResult
        )
          ? symbolsResult
          : Array.isArray(
              symbolsResult?.data
            )
          ? symbolsResult.data
          : [];

      // ========================================================
      // BOTS
      // ========================================================

      const loadedBots =
        Array.isArray(
          botsResult
        )
          ? botsResult
          : Array.isArray(
              botsResult?.data
            )
          ? botsResult.data
          : [];

      console.log(
        "[Bot Management] Symbols:",
        loadedSymbols
      );

      console.log(
        "[Bot Management] Bots:",
        loadedBots
      );

      setSymbols(
        loadedSymbols
      );

      setBots(
        loadedBots
      );

      // ========================================================
      // DEFAULT SYMBOL
      // ========================================================

      if (
        loadedSymbols.length > 0 &&
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
        err.message ||
        "Failed to load bot data."
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

    // ==========================================================
    // TRIGGER LINE VALIDATION
    // ==========================================================

    let cleanTriggerLinePrice =
      null;

    if (
      triggerLineEnabled
    ) {
      const triggerPrice =
        Number(
          triggerLinePrice
        );

      if (
        !Number.isFinite(
          triggerPrice
        ) ||
        triggerPrice <= 0
      ) {
        setError(
          "Trigger Line Price must be greater than 0 when Trigger Line is enabled."
        );

        return;
      }

      cleanTriggerLinePrice =
        triggerPrice;
    }

    // ==========================================================
    // SL VALIDATION
    // ==========================================================

    if (
      !Number.isFinite(sl) ||
      sl <= 0
    ) {
      setError(
        "Stop Loss must be greater than 0."
      );

      return;
    }

    // ==========================================================
    // TP VALIDATION
    // ==========================================================

    if (
      !Number.isFinite(tp) ||
      tp <= 0
    ) {
      setError(
        "Take Profit must be greater than 0."
      );

      return;
    }

    // ==========================================================
    // PYRAMID VALIDATION
    // ==========================================================

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

          pyramidPositions:
            pyramid,

          triggerLineEnabled:
            triggerLineEnabled,

          triggerLinePrice:
            cleanTriggerLinePrice,
        });

      // ========================================================
      // SUPPORT BOTH:
      //
      // DIRECT BOT
      //
      // AND:
      //
      // {
      //   data: bot
      // }
      // ========================================================

      const newBot =
        result?.data?.id
          ? result.data
          : result?.id
          ? result
          : null;

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

      // ========================================================
      // RESET FORM
      // ========================================================

      setBotName("");

      setDirection(
        "LONG"
      );

      setStopLoss(
        "3"
      );

      setTakeProfit(
        "5"
      );

      setPyramidPositions(
        "1"
      );

      setTriggerLineEnabled(
        false
      );

      setTriggerLinePrice(
        ""
      );

      setMessage(
        "Bot created successfully."
      );
    } catch (err) {
      console.error(
        "[Bot Management] Create error:",
        err
      );

      setError(
        err.message ||
        "Failed to create bot."
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
        err.message ||
        "Failed to change bot status."
      );
    } finally {
      setActionBotId("");
    }
  }

  // ============================================================
  // ENTRY MODEL START / STOP
  // ============================================================

  async function handleEntryModelToggle(
    bot
  ) {
    try {
      setEntryModelActionBotId(
        bot.id
      );

      setMessage("");
      setError("");

      // ========================================================
      // CHECK CURRENT ENGINE STATE
      // ========================================================

      const engineRunning =
        bot.entryModelRunning ===
        true ||
        bot.entryModelStatus ===
        "RUNNING" ||
        bot.entryModelState ===
        "RUNNING";

      // ========================================================
      // STOP
      // ========================================================

      if (engineRunning) {
        console.log(
          `[Bot Management] STOP ENTRY MODEL | Bot=${bot.id}`
        );

        await stopEntryModel(
          bot.id
        );

        setMessage(
          `${bot.name} Entry Model stopped.`
        );
      }

      // ========================================================
      // START
      // ========================================================

      else {
        console.log(
          `[Bot Management] START ENTRY MODEL | Bot=${bot.id}`
        );

        await startEntryModel(
          bot.id
        );

        setMessage(
          `${bot.name} Entry Model started.`
        );
      }

      // ========================================================
      // REFRESH BOT DATA
      // ========================================================

      await loadData();
    } catch (err) {
      console.error(
        "[Bot Management] Entry Model error:",
        err
      );

      setError(
        err.message ||
        "Failed to change Entry Model state."
      );
    } finally {
      setEntryModelActionBotId("");
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
        err.message ||
        "Failed to delete bot."
      );
    } finally {
      setDeletingBotId("");
    }
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="bot-management-page">

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

            {/* BOT NAME */}

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

            {/* TRADING COIN */}

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

            {/* DIRECTION */}

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

            {/* ENTRY MODEL */}

            <div className="bot-form-group">
              <label>
                ENTRY MODEL
              </label>

              <div className="bot-static-field">
                Button Press
              </div>
            </div>

            {/* STOP LOSS */}

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

            {/* TAKE PROFIT */}

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

            {/* PYRAMID POSITIONS */}

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

            {/* TRIGGER LINE */}

            <div className="bot-form-group">

              <label>
                TRIGGER LINE
              </label>

              <label
                style={{
                  display:
                    "flex",

                  alignItems:
                    "center",

                  gap:
                    "10px",

                  cursor:
                    "pointer",

                  marginTop:
                    "8px",
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    triggerLineEnabled
                  }
                  onChange={
                    (event) =>
                      setTriggerLineEnabled(
                        event.target.checked
                      )
                  }
                  style={{
                    width:
                      "18px",

                    height:
                      "18px",

                    cursor:
                      "pointer",
                  }}
                />

                <span>
                  Enable Trigger Line
                </span>
              </label>

              <small>
                When enabled, the bot starts in NEUTRAL mode.
              </small>

            </div>

            {/* TRIGGER PRICE */}

            <div className="bot-form-group">

              <label>
                TRIGGER PRICE
              </label>

              <input
                type="number"
                min="0"
                step="any"
                value={
                  triggerLinePrice
                }
                onChange={
                  (event) =>
                    setTriggerLinePrice(
                      event.target.value
                    )
                }
                disabled={
                  !triggerLineEnabled
                }
                placeholder="0.00000"
              />

              <small>
                Required when Trigger Line is enabled.
              </small>

            </div>

          </div>

          {/* CREATE BUTTON */}

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
            (bot) => {

              const botPyramid =
                Number(
                  bot.pyramidPositions ??
                  bot.maxPositions ??
                  1
                );

              const botCurrentPositions =
                Number(
                  bot.currentPositionCount ??
                  0
                );

              const triggerEnabled =
                bot.triggerLineEnabled ===
                true;

              const engineRunning =
                bot.entryModelRunning ===
                true ||
                bot.entryModelStatus ===
                "RUNNING" ||
                bot.entryModelState ===
                "RUNNING";

              return (
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

                    {/* DIRECTION */}

                    <div>
                      <span>
                        DIRECTION
                      </span>

                      <strong>
                        {bot.direction}
                      </strong>
                    </div>

                    {/* ENTRY */}

                    <div>
                      <span>
                        ENTRY
                      </span>

                      <strong>
                        Button Press
                      </strong>
                    </div>

                    {/* SL */}

                    <div>
                      <span>
                        SL
                      </span>

                      <strong>
                        {bot.stopLoss}%
                      </strong>
                    </div>

                    {/* TP */}

                    <div>
                      <span>
                        TP
                      </span>

                      <strong>
                        {bot.takeProfit}%
                      </strong>
                    </div>

                    {/* PYRAMID */}

                    <div>
                      <span>
                        PYRAMID
                      </span>

                      <strong>
                        {botCurrentPositions}/
                        {botPyramid}
                      </strong>
                    </div>

                    {/* TRIGGER LINE */}

                    <div>
                      <span>
                        TRIGGER LINE
                      </span>

                      <strong>
                        {triggerEnabled
                          ? "ON"
                          : "OFF"}
                      </strong>
                    </div>

                    {/* TRIGGER PRICE */}

                    {triggerEnabled && (
                      <div>
                        <span>
                          TRIGGER PRICE
                        </span>

                        <strong>
                          {bot.triggerLinePrice ??
                            "-"}
                        </strong>
                      </div>
                    )}

                    {/* TRIGGER STATE */}

                    <div>
                      <span>
                        TRIGGER STATE
                      </span>

                      <strong>
                        {triggerEnabled
                          ? (
                            bot.triggerState ||
                            "NEUTRAL"
                          )
                          : "OFF"}
                      </strong>
                    </div>

                    {/* ENTRY MODEL STATE */}

                    <div>
                      <span>
                        ENTRY MODEL
                      </span>

                      <strong>
                        {engineRunning
                          ? "RUNNING"
                          : "STOPPED"}
                      </strong>
                    </div>

                  </div>

                  <div className="bot-card-actions">

                    {/* ENTRY MODEL START / STOP */}

                    <button
                      type="button"
                      className="bot-toggle-button"
                      onClick={() =>
                        handleEntryModelToggle(
                          bot
                        )
                      }
                      disabled={
                        entryModelActionBotId ===
                          bot.id ||
                        deletingBotId ===
                          bot.id ||
                        actionBotId ===
                          bot.id ||
                        bot.status !==
                          "ACTIVE"
                      }
                    >
                      {entryModelActionBotId ===
                      bot.id
                        ? "WORKING..."
                        : engineRunning
                        ? "STOP ENTRY MODEL"
                        : "START ENTRY MODEL"}
                    </button>

                    {/* PAUSE / RESUME */}

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
                          bot.id ||
                        entryModelActionBotId ===
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

                    {/* DELETE */}

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
                          bot.id ||
                        entryModelActionBotId ===
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
              );
            }
          )}

        </div>

      </div>

    </div>
  );
}

export default BotManagement;
