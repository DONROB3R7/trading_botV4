import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getBots,
  getPriceModel,
  getCombinedEntryModel,
  startCombinedEntryModel,
  stopCombinedEntryModel,
} from "../api";

import "./EntryModelCombined.css";

// ============================================================
// HELPERS
// ============================================================

function normalizeDirection(value) {
  const text =
    String(value || "")
      .trim()
      .toUpperCase();

  if (
    text === "LONG" ||
    text === "SHORT"
  ) {
    return text;
  }

  return "NEUTRAL";
}

function getDirectionClass(
  direction
) {
  const normalized =
    normalizeDirection(
      direction
    );

  if (
    normalized === "LONG"
  ) {
    return "long";
  }

  if (
    normalized === "SHORT"
  ) {
    return "short";
  }

  return "neutral";
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function EntryModelCombined() {

  const [bots, setBots] =
    useState([]);

  const [
    selectedBotId,
    setSelectedBotId,
  ] = useState("");

  const [
    priceModel,
    setPriceModel,
  ] = useState(null);

  const [
    combinedModel,
    setCombinedModel,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

  // ==========================================================
  // SELECTED BOT
  // ==========================================================

  const selectedBot =
    useMemo(
      () =>
        bots.find(
          (bot) =>
            String(bot.id) ===
            String(selectedBotId)
        ),
      [
        bots,
        selectedBotId,
      ]
    );

  // ==========================================================
  // LOAD BOTS
  // ==========================================================

  const loadBots =
    useCallback(
      async () => {

        try {

          const data =
            await getBots();

          const list =
            Array.isArray(data)
              ? data
              : data?.bots || [];

          setBots(list);

          if (
            !selectedBotId &&
            list.length > 0
          ) {
            setSelectedBotId(
              list[0].id
            );
          }

        } catch (err) {

          console.error(
            "[Entry Model Combined] " +
              "Bot load error:",
            err
          );

          setError(
            err.message ||
              "Failed to load bots"
          );
        }

      },
      [selectedBotId]
    );

  // ==========================================================
  // LOAD PRICE MODEL
  // ==========================================================

  const loadPriceModel =
    useCallback(
      async () => {

        if (!selectedBotId) {
          return;
        }

        try {

          const data =
            await getPriceModel(
              selectedBotId
            );

          setPriceModel(
            data?.model ||
            null
          );

        } catch (err) {

          console.error(
            "[Entry Model Combined] " +
              "Price Model load error:",
            err
          );

          setError(
            err.message ||
              "Failed to load Price Model"
          );
        }

      },
      [selectedBotId]
    );

  // ==========================================================
  // LOAD COMBINED MODEL
  // ==========================================================

  const loadCombinedModel =
    useCallback(
      async () => {

        if (!selectedBotId) {
          return;
        }

        try {

          const data =
            await getCombinedEntryModel(
              selectedBotId
            );

          setCombinedModel(
            data?.model ||
            null
          );

        } catch (err) {

          console.error(
            "[Entry Model Combined] " +
              "Combined Model load error:",
            err
          );

          setError(
            err.message ||
              "Failed to load Combined Entry Model"
          );
        }

      },
      [selectedBotId]
    );

  // ==========================================================
  // INITIAL BOTS
  // ==========================================================

  useEffect(() => {

    loadBots();

  }, [loadBots]);

  // ==========================================================
  // LOAD MODELS
  // ==========================================================

  useEffect(() => {

    if (!selectedBotId) {
      return;
    }

    loadPriceModel();
    loadCombinedModel();

  }, [
    selectedBotId,
    loadPriceModel,
    loadCombinedModel,
  ]);

  // ==========================================================
  // REFRESH
  // ==========================================================

  useEffect(() => {

    if (!selectedBotId) {
      return;
    }

    const timer =
      setInterval(
        () => {

          loadPriceModel();
          loadCombinedModel();

        },
        3000
      );

    return () => {
      clearInterval(timer);
    };

  }, [
    selectedBotId,
    loadPriceModel,
    loadCombinedModel,
  ]);

  // ==========================================================
  // START COMBINED
  // ==========================================================

  const handleStart =
    async () => {

      if (
        !selectedBotId ||
        actionLoading
      ) {
        return;
      }

      try {

        setActionLoading(true);
        setError("");

        const data =
          await startCombinedEntryModel(
            selectedBotId
          );

        setCombinedModel(
          data?.model ||
          null
        );

        await loadPriceModel();
        await loadCombinedModel();

      } catch (err) {

        console.error(
          "[Entry Model Combined] " +
            "Start error:",
          err
        );

        setError(
          err.message ||
            "Failed to start Combined Entry Model"
        );

      } finally {

        setActionLoading(false);

      }

    };

  // ==========================================================
  // STOP COMBINED
  // ==========================================================

  const handleStop =
    async () => {

      if (
        !selectedBotId ||
        actionLoading
      ) {
        return;
      }

      try {

        setActionLoading(true);
        setError("");

        const data =
          await stopCombinedEntryModel(
            selectedBotId
          );

        setCombinedModel(
          data?.model ||
          null
        );

        await loadPriceModel();
        await loadCombinedModel();

      } catch (err) {

        console.error(
          "[Entry Model Combined] " +
            "Stop error:",
          err
        );

        setError(
          err.message ||
            "Failed to stop Combined Entry Model"
        );

      } finally {

        setActionLoading(false);

      }

    };

  // ==========================================================
  // REAL COMBINED STATE
  // ==========================================================

  const combinedRunning =
    Boolean(
      combinedModel?.running
    );

  const priceRunning =
    Boolean(
      priceModel?.running
    );

  const direction =
    normalizeDirection(
      combinedModel?.direction
    );

  const campaignNumber =
    combinedModel?.campaignNumber ??
    0;

  const activeBot =
    combinedModel?.activeBotId ||
    "NONE";

  const orderbookCycle =
    combinedModel?.orderbookCycle;

  const maxOrderbookCycles =
    combinedModel?.maxOrderbookCycles ??
    3;

  const orderbookScan =
    combinedModel?.orderbookScan;

  const scansPerCycle =
    combinedModel?.scansPerCycle ??
    15;

  const confirmations =
    combinedModel?.confirmations ??
    0;

  const requiredConfirmations =
    combinedModel?.requiredConfirmations ??
    3;

  const pyramidCount =
    combinedModel?.pyramidCount ??
    0;

  const maxPyramid =
    combinedModel?.maxPyramid ??
    selectedBot?.pyramidPositions ??
    0;

  const controllerState =
    combinedModel?.state ||
    "IDLE";

  const finalResult =
    combinedModel?.finalResult;

  // ==========================================================
  // DISPLAY FINAL
  // ==========================================================

  let finalState =
    "WAITING";

  if (
    controllerState ===
    "PRICE_SIGNAL"
  ) {
    finalState =
      "PRICE SIGNAL";
  }

  if (
    controllerState ===
    "ORDERBOOK_HUNT"
  ) {
    finalState =
      "ORDERBOOK HUNT";
  }

  if (
    controllerState ===
    "ENTRY"
  ) {
    finalState =
      "ENTRY READY";
  }

  if (
    controllerState ===
    "HUNT_AGAIN"
  ) {
    finalState =
      "WAITING FOR NEXT PRICE";
  }

  if (
    controllerState ===
    "PYRAMID_FULL"
  ) {
    finalState =
      "PYRAMID FULL";
  }

  if (
    finalResult ===
    "SIGNAL_EXPIRED"
  ) {
    finalState =
      "SIGNAL EXPIRED";
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="entry-model-page-combined">

      {/* ==================================================
          HEADER
          ================================================== */}

      <div className="entry-model-header">

        <div>

          <h1>
            Combined Entry Model
          </h1>

          <div className="entry-model-subtitle">
            Price Direction → Orderbook Entry
          </div>

        </div>

        <div className="entry-model-controls">

          <select
            value={
              selectedBotId
            }
            onChange={(
              event
            ) => {

              setSelectedBotId(
                event.target.value
              );

              setPriceModel(
                null
              );

              setCombinedModel(
                null
              );

              setError("");

            }}
          >

            <option value="">
              Select Bot
            </option>

            {bots.map(
              (bot) => (

                <option
                  key={bot.id}
                  value={bot.id}
                >
                  {bot.name ||
                    bot.symbol ||
                    bot.id}
                </option>

              )
            )}

          </select>

        </div>

      </div>

      {/* ==================================================
          ERROR
          ================================================== */}

      {error && (
        <div className="entry-model-error">
          {error}
        </div>
      )}

      {/* ==================================================
          BOT INFO
          ================================================== */}

      {selectedBot && (

        <div className="entry-model-info">

          <div>
            <span>
              Bot
            </span>

            <strong>
              {selectedBot.name ||
                selectedBot.id}
            </strong>
          </div>

          <div>
            <span>
              Symbol
            </span>

            <strong>
              {selectedBot.symbol ||
                priceModel?.symbol ||
                "-"}
            </strong>
          </div>

          <div>
            <span>
              Price Model
            </span>

            <strong
              className={
                priceRunning
                  ? "long"
                  : "neutral"
              }
            >
              {priceRunning
                ? "RUNNING"
                : "STOPPED"}
            </strong>
          </div>

          <div>
            <span>
              Combined
            </span>

            <strong
              className={
                combinedRunning
                  ? "long"
                  : "neutral"
              }
            >
              {combinedRunning
                ? "RUNNING"
                : "STOPPED"}
            </strong>
          </div>

        </div>

      )}

      {/* ==================================================
          CONTROLS
          ================================================== */}

      {selectedBot && (

        <div className="entry-model-action-buttons">

          <button
            type="button"
            className="entry-model-action-start"
            onClick={handleStart}
            disabled={
              actionLoading ||
              combinedRunning
            }
          >
            {actionLoading
              ? "STARTING..."
              : "START COMBINED"}
          </button>

         <button
            type="button"
            className="entry-model-action-stop"
            onClick={handleStop}
            disabled={
              actionLoading ||
              !combinedRunning
            }
          >
            {actionLoading
              ? "STOPPING..."
              : "STOP COMBINED"}
          </button>

        </div>

      )}

      {/* ==================================================
          COMBINED LOGIC
          ================================================== */}

      <section className="entry-model-section">

        <div className="entry-model-section-header">

          <h2>
            Combined Logic
          </h2>

          <div>
            Controller: {controllerState}
          </div>

        </div>

        <div className="entry-model-combined-status">

          {/* DIRECTION */}

          <div className="entry-model-combined-row">

            <span>
              Direction
            </span>

            <strong
              className={
                getDirectionClass(
                  direction
                )
              }
            >
              {direction}
            </strong>

          </div>

          {/* CAMPAIGN */}

          <div className="entry-model-combined-row">

            <span>
              Campaign
            </span>

            <strong>
              {campaignNumber}
            </strong>

          </div>

          {/* ACTIVE BOT */}

          <div className="entry-model-combined-row">

            <span>
              Active Bot
            </span>

            <strong>
              {activeBot}
            </strong>

          </div>

          {/* ORDERBOOK CYCLE */}

          <div className="entry-model-combined-row">

            <span>
              Orderbook Cycle
            </span>

            <strong>
              {controllerState ===
              "ORDERBOOK_HUNT"
                ? `${orderbookCycle} / ${maxOrderbookCycles}`
                : "-"}
            </strong>

          </div>

          {/* ORDERBOOK SCANS */}

          <div className="entry-model-combined-row">

            <span>
              Orderbook Scans
            </span>

            <strong>
              {controllerState ===
              "ORDERBOOK_HUNT"
                ? `${orderbookScan} / ${scansPerCycle}`
                : "-"}
            </strong>

          </div>

          {/* CONFIRMATIONS */}

          <div className="entry-model-combined-row">

            <span>
              Confirmations
            </span>

            <strong>
              {controllerState ===
              "ORDERBOOK_HUNT"
                ? `${confirmations} / ${requiredConfirmations}`
                : "-"}
            </strong>

          </div>

          {/* PYRAMID */}

          <div className="entry-model-combined-row">

            <span>
              Pyramid
            </span>

            <strong>
              {pyramidCount} / {maxPyramid}
            </strong>

          </div>

        </div>

        {/* ==================================================
            FINAL
            ================================================== */}

        <div className="entry-model-combined-final">

          <span>
            FINAL
          </span>

          <strong
            className={
              getDirectionClass(
                direction
              )
            }
          >
            {finalState}
          </strong>

        </div>

      </section>

    </div>
  );
}