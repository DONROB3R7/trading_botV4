import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createChart,
  CandlestickSeries,
  createSeriesMarkers,
} from "lightweight-charts";

import {
  getBots,
  getChart,
  enterBot,
  closeBot,
} from "../api";

import "./ChartBot.css";

const BERLIN_TIME_ZONE =
  "Europe/Berlin";

const REFRESH_INTERVAL =
  30 * 1000;

function formatBerlinTime(
  timestamp
) {
  const date =
    new Date(
      timestamp * 1000
    );

  return new Intl.DateTimeFormat(
    "de-DE",
    {
      timeZone:
        BERLIN_TIME_ZONE,

      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit",

      hour12:
        false,
    }
  ).format(date);
}

function ChartBot() {
  // ============================================================
  // CHART REFS
  // ============================================================

  const chartContainerRef =
    useRef(null);

  const chartRef =
    useRef(null);

  const candleSeriesRef =
    useRef(null);

  const markersRef =
    useRef(null);

  // ============================================================
  // CHART LIFECYCLE SAFETY
  // ============================================================

  const chartMountedRef =
    useRef(false);

  const chartGenerationRef =
    useRef(0);

  // ============================================================
  // TRIGGER LINE REF
  // ============================================================

  const triggerLineRef =
    useRef(null);

  const entryMarkersRef =
    useRef([]);

  const entryCountRef =
    useRef(0);

  const latestCandleRef =
    useRef(null);

  const selectedBotRef =
    useRef(null);

  // ============================================================
  // BOT STATE
  // ============================================================

  const [
    bots,
    setBots,
  ] = useState([]);

  const [
    selectedBotId,
    setSelectedBotId,
  ] = useState("");

  const [
    loadingBots,
    setLoadingBots,
  ] = useState(true);

  const [
    chartLoading,
    setChartLoading,
  ] = useState(false);

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  // ============================================================
  // SELECTED BOT
  // ============================================================

  const selectedBot =
    bots.find(
      (bot) =>
        bot.id ===
        selectedBotId
    ) || null;

  selectedBotRef.current =
    selectedBot;

  // ============================================================
  // PYRAMID STATE
  // ============================================================

  const pyramidMax =
    Number(
      selectedBot?.pyramidPositions ??
      selectedBot?.maxPositions ??
      1
    );

  const pyramidCurrent =
    Number(
      selectedBot?.currentPositionCount ??
      0
    );

  const pyramidReachedMax =
    pyramidCurrent >=
    pyramidMax;

  // ============================================================
  // TRIGGER LINE STATE
  // ============================================================

  const triggerLineEnabled =
    selectedBot?.triggerLineEnabled ===
    true;

  const triggerLinePrice =
    Number(
      selectedBot?.triggerLinePrice
    );

  const triggerState =
    selectedBot?.triggerState ||
    (triggerLineEnabled
      ? "NEUTRAL"
      : "ARMED");

  const botIsNeutral =
    triggerLineEnabled &&
    triggerState ===
      "NEUTRAL";

  const enterBlocked =
    !selectedBot ||
    actionLoading ||
    selectedBot.status !==
      "ACTIVE" ||
    botIsNeutral ||
    pyramidReachedMax;

  // ============================================================
  // CLEAR TRIGGER LINE
  // ============================================================

  function clearTriggerLine() {
    if (
      triggerLineRef.current &&
      candleSeriesRef.current
    ) {
      try {
        candleSeriesRef.current.removePriceLine(
          triggerLineRef.current
        );
      } catch (error) {
        console.warn(
          "[Chart Bot] Could not remove trigger line:",
          error
        );
      }
    }

    triggerLineRef.current =
      null;
  }

  // ============================================================
  // UPDATE TRIGGER LINE
  // ============================================================

  function updateTriggerLine(
    bot = selectedBotRef.current
  ) {
    if (
      !chartMountedRef.current
    ) {
      return;
    }

    clearTriggerLine();

    if (
      !candleSeriesRef.current
    ) {
      return;
    }

    if (!bot) {
      return;
    }

    if (
      bot.triggerLineEnabled !==
      true
    ) {
      return;
    }

    const price =
      Number(
        bot.triggerLinePrice
      );

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      console.warn(
        "[Chart Bot] Trigger Line enabled but trigger price is invalid:",
        bot.triggerLinePrice
      );

      return;
    }

    // ----------------------------------------------------------
    // FINAL SAFETY CHECK
    // ----------------------------------------------------------

    if (
      !chartMountedRef.current ||
      !candleSeriesRef.current
    ) {
      return;
    }

    triggerLineRef.current =
      candleSeriesRef.current.createPriceLine(
        {
          price:
            price,

          color:
            "#facc15",

          lineWidth:
            2,

          lineStyle:
            2,

          axisLabelVisible:
            true,

          title:
            "TRIGGER",
        }
      );

    console.log(
      `[Chart Bot] Trigger line drawn at ${price}`
    );
  }

  // ============================================================
  // CLEAR ENTRY MARKERS
  // ============================================================

  function clearEntryMarkers() {
    entryMarkersRef.current =
      [];

    entryCountRef.current =
      0;

    if (
      markersRef.current
    ) {
      try {
        markersRef.current.setMarkers(
          []
        );
      } catch (error) {
        console.warn(
          "[Chart Bot] Could not clear markers:",
          error
        );
      }
    }
  }

  // ============================================================
  // ADD ENTRY MARKER
  // ============================================================

  function addEntryMarker(
    direction,
    entryNumber
  ) {
    if (
      !chartMountedRef.current ||
      !markersRef.current ||
      !latestCandleRef.current
    ) {
      console.warn(
        "[Chart Bot] Cannot add entry marker - chart candle unavailable"
      );

      return;
    }

    const normalizedDirection =
      String(
        direction || ""
      )
        .trim()
        .toUpperCase();

    if (
      !["LONG", "SHORT"].includes(
        normalizedDirection
      )
    ) {
      return;
    }

    const candle =
      latestCandleRef.current;

    const marker =
      normalizedDirection ===
      "LONG"
        ? {
            time:
              candle.time,

            position:
              "belowBar",

            color:
              "#22c55e",

            shape:
              "arrowUp",

            text:
              `LONG #${entryNumber}`,
          }
        : {
            time:
              candle.time,

            position:
              "aboveBar",

            color:
              "#ef4444",

            shape:
              "arrowDown",

            text:
              `SHORT #${entryNumber}`,
          };

    entryMarkersRef.current = [
      ...entryMarkersRef.current,
      marker,
    ];

    if (
      !chartMountedRef.current ||
      !markersRef.current
    ) {
      return;
    }

    try {
      markersRef.current.setMarkers(
        entryMarkersRef.current
      );
    } catch (error) {
      console.warn(
        "[Chart Bot] Could not set entry marker:",
        error
      );
    }

    console.log(
      `[Chart Bot] ${normalizedDirection} #${entryNumber} marker added at candle ${candle.time}`
    );
  }

  // ============================================================
  // LOAD BOTS
  // ============================================================

  async function loadBots() {
    try {
      setLoadingBots(true);

      const result =
        await getBots();

      // ========================================================
      // CURRENT BACKEND:
      //
      // GET /api/bots
      //
      // RETURNS:
      //
      // [
      //   {
      //     id: "...",
      //     name: "...",
      //     symbol: "POLUSDT"
      //   }
      // ]
      //
      // Also support old:
      //
      // {
      //   data: [...]
      // }
      // ========================================================

      const loadedBots =
        Array.isArray(
          result
        )
          ? result
          : Array.isArray(
              result?.data
            )
          ? result.data
          : [];

      console.log(
        "[Chart Bot] Loaded bots:",
        loadedBots
      );

      setBots(
        loadedBots
      );

      // --------------------------------------------------------
      // Automatically select first bot.
      // --------------------------------------------------------

      if (
        loadedBots.length >
          0 &&
        !selectedBotId
      ) {
        setSelectedBotId(
          loadedBots[0].id
        );
      }

      // --------------------------------------------------------
      // If selected bot was deleted.
      // --------------------------------------------------------

      if (
        selectedBotId &&
        loadedBots.length >
          0 &&
        !loadedBots.some(
          (bot) =>
            bot.id ===
            selectedBotId
        )
      ) {
        setSelectedBotId(
          loadedBots[0].id
        );
      }

      // --------------------------------------------------------
      // No bots.
      // --------------------------------------------------------

      if (
        loadedBots.length ===
        0
      ) {
        setSelectedBotId("");
      }

      return loadedBots;

    } catch (err) {
      console.error(
        "[Chart Bot] Bot load error:",
        err
      );

      setError(
        err.message ||
        "Failed to load bots."
      );

      return [];

    } finally {
      setLoadingBots(false);
    }
  }

  useEffect(() => {
    loadBots();
  }, []);

  // ============================================================
  // LOAD CHART
  // ============================================================

  async function loadBotChart(
    bot,
    keepZoom = true
  ) {
    if (
      !bot ||
      !bot.symbol
    ) {
      return;
    }

    // ----------------------------------------------------------
    // CAPTURE CURRENT CHART GENERATION
    // ----------------------------------------------------------

    const requestGeneration =
      chartGenerationRef.current;

    if (
      !chartMountedRef.current ||
      !chartRef.current ||
      !candleSeriesRef.current
    ) {
      console.warn(
        "[Chart Bot] Chart not ready - skipping chart load"
      );

      return;
    }

    try {
      setChartLoading(true);
      setError("");

      const result =
        await getChart(
          bot.symbol
        );

      // ========================================================
      // ASYNC SAFETY CHECK
      //
      // The chart may have been destroyed while getChart()
      // was waiting for the backend.
      // ========================================================

      if (
        !chartMountedRef.current
      ) {
        console.log(
          "[Chart Bot] Chart was unmounted while loading - ignoring result"
        );

        return;
      }

      if (
        requestGeneration !==
        chartGenerationRef.current
      ) {
        console.log(
          "[Chart Bot] Old chart generation - ignoring result"
        );

        return;
      }

      if (
        !chartRef.current ||
        !candleSeriesRef.current
      ) {
        console.log(
          "[Chart Bot] Chart refs became unavailable - ignoring result"
        );

        return;
      }

      // ========================================================
      // SUPPORT:
      //
      // direct array
      //
      // OR:
      //
      // { data: [...] }
      // ========================================================

      const chartData =
        Array.isArray(
          result
        )
          ? result
          : Array.isArray(
              result?.data
            )
          ? result.data
          : [];

      if (
        !Array.isArray(
          chartData
        )
      ) {
        throw new Error(
          "Invalid chart data"
        );
      }

      // --------------------------------------------------------
      // BOT SAFETY
      // --------------------------------------------------------

      if (
        selectedBotRef.current?.id !==
        bot.id
      ) {
        console.log(
          "[Chart Bot] Bot changed while chart was loading - ignoring old result"
        );

        return;
      }

      // --------------------------------------------------------
      // FINAL SETDATA SAFETY
      // --------------------------------------------------------

      if (
        !chartMountedRef.current ||
        requestGeneration !==
          chartGenerationRef.current ||
        !chartRef.current ||
        !candleSeriesRef.current
      ) {
        console.log(
          "[Chart Bot] Chart became unavailable before setData - skipping"
        );

        return;
      }

      // --------------------------------------------------------
      // SET CANDLE DATA
      // --------------------------------------------------------

      candleSeriesRef.current.setData(
        chartData
      );

      // --------------------------------------------------------
      // SAVE LATEST CANDLE
      // --------------------------------------------------------

      if (
        chartData.length >
        0
      ) {
        latestCandleRef.current =
          chartData[
            chartData.length - 1
          ];
      }

      // --------------------------------------------------------
      // RE-APPLY ENTRY MARKERS
      // --------------------------------------------------------

      if (
        chartMountedRef.current &&
        markersRef.current
      ) {
        try {
          markersRef.current.setMarkers(
            entryMarkersRef.current
          );
        } catch (error) {
          console.warn(
            "[Chart Bot] Could not restore entry markers:",
            error
          );
        }
      }

      // --------------------------------------------------------
      // DRAW TRIGGER LINE
      // --------------------------------------------------------

      if (
        chartMountedRef.current &&
        candleSeriesRef.current
      ) {
        updateTriggerLine(
          bot
        );
      }

      // --------------------------------------------------------
      // FIT CHART
      // --------------------------------------------------------

      if (
        !keepZoom &&
        chartMountedRef.current &&
        chartRef.current
      ) {
        chartRef.current
          .timeScale()
          .fitContent();
      }

    } catch (err) {
      console.error(
        "[Chart Bot] Chart load error:",
        err
      );

      if (
        chartMountedRef.current &&
        selectedBotRef.current?.id ===
          bot.id
      ) {
        setError(
          err.message ||
          "Failed to load chart."
        );
      }

    } finally {
      if (
        chartMountedRef.current
      ) {
        setChartLoading(
          false
        );
      }
    }
  }

  // ============================================================
  // CREATE CHART
  // ============================================================

  useEffect(() => {
    if (
      !chartContainerRef.current
    ) {
      return;
    }

    // ----------------------------------------------------------
    // NEW CHART GENERATION
    // ----------------------------------------------------------

    chartGenerationRef.current +=
      1;

    const currentGeneration =
      chartGenerationRef.current;

    const chart =
      createChart(
        chartContainerRef.current,
        {
          layout: {
            background: {
              color:
                "#08111f",
            },

            textColor:
              "#cbd5e1",
          },

          grid: {
            vertLines: {
              color:
                "#172235",
            },

            horzLines: {
              color:
                "#172235",
            },
          },

          width:
            chartContainerRef.current
              .clientWidth,

          height:
            600,

          rightPriceScale: {
            borderColor:
              "#26354d",
          },

          timeScale: {
            borderColor:
              "#26354d",

            timeVisible:
              true,

            secondsVisible:
              true,

            tickMarkFormatter:
              (time) =>
                formatBerlinTime(
                  time
                ),
          },

          localization: {
            timeFormatter:
              (time) =>
                formatBerlinTime(
                  time
                ),
          },
        }
      );

    const candleSeries =
      chart.addSeries(
        CandlestickSeries,
        {
          upColor:
            "#22c55e",

          downColor:
            "#ef4444",

          borderUpColor:
            "#22c55e",

          borderDownColor:
            "#ef4444",

          wickUpColor:
            "#22c55e",

          wickDownColor:
            "#ef4444",
        }
      );

    const markerController =
      createSeriesMarkers(
        candleSeries,
        []
      );

    // ----------------------------------------------------------
    // SAVE REFS
    // ----------------------------------------------------------

    chartRef.current =
      chart;

    candleSeriesRef.current =
      candleSeries;

    markersRef.current =
      markerController;

    chartMountedRef.current =
      true;

    console.log(
      `[Chart Bot] Chart created | Generation=${currentGeneration}`
    );

    // ----------------------------------------------------------
    // RESIZE
    // ----------------------------------------------------------

    const handleResize =
      () => {
        if (
          !chartMountedRef.current ||
          !chartContainerRef.current ||
          !chartRef.current
        ) {
          return;
        }

        chartRef.current.applyOptions(
          {
            width:
              chartContainerRef.current
                .clientWidth,
          }
        );
      };

    window.addEventListener(
      "resize",
      handleResize
    );

    // ----------------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------------

    return () => {
      console.log(
        `[Chart Bot] Destroying chart | Generation=${currentGeneration}`
      );

      // --------------------------------------------------------
      // Mark chart dead FIRST.
      // This prevents async getChart() from touching it.
      // --------------------------------------------------------

      chartMountedRef.current =
        false;

      // --------------------------------------------------------
      // Invalidate every pending chart request.
      // --------------------------------------------------------

      chartGenerationRef.current +=
        1;

      window.removeEventListener(
        "resize",
        handleResize
      );

      // --------------------------------------------------------
      // Remove trigger line safely.
      // --------------------------------------------------------

      if (
        triggerLineRef.current &&
        candleSeriesRef.current
      ) {
        try {
          candleSeriesRef.current.removePriceLine(
            triggerLineRef.current
          );
        } catch (error) {
          console.warn(
            "[Chart Bot] Cleanup trigger line failed:",
            error
          );
        }
      }

      triggerLineRef.current =
        null;

      // --------------------------------------------------------
      // Remove chart.
      // --------------------------------------------------------

      try {
        chart.remove();
      } catch (error) {
        console.warn(
          "[Chart Bot] Chart cleanup failed:",
          error
        );
      }

      // --------------------------------------------------------
      // Clear refs AFTER chart removal.
      // --------------------------------------------------------

      chartRef.current =
        null;

      candleSeriesRef.current =
        null;

      markersRef.current =
        null;

      latestCandleRef.current =
        null;
    };
  }, []);

  // ============================================================
  // BOT CHANGE
  // ============================================================

  useEffect(() => {
    if (
      !selectedBot
    ) {
      clearTriggerLine();

      return;
    }

    clearEntryMarkers();

    latestCandleRef.current =
      null;

    clearTriggerLine();

    // ----------------------------------------------------------
    // Clear old chart only if chart is alive.
    // ----------------------------------------------------------

    if (
      chartMountedRef.current &&
      candleSeriesRef.current
    ) {
      try {
        candleSeriesRef.current.setData(
          []
        );
      } catch (error) {
        console.warn(
          "[Chart Bot] Could not clear old chart:",
          error
        );
      }
    }

    // ----------------------------------------------------------
    // Load selected bot chart.
    // ----------------------------------------------------------

    loadBotChart(
      selectedBot,
      false
    );
  }, [
    selectedBotId,
  ]);

  // ============================================================
  // TRIGGER LINE SYNC
  // ============================================================

  useEffect(() => {
    if (
      !selectedBot ||
      !chartMountedRef.current ||
      !candleSeriesRef.current
    ) {
      clearTriggerLine();

      return;
    }

    updateTriggerLine(
      selectedBot
    );
  }, [
    selectedBot?.triggerLineEnabled,
    selectedBot?.triggerLinePrice,
    selectedBot?.triggerState,
  ]);

  // ============================================================
  // AUTO REFRESH
  // ============================================================

  useEffect(() => {
    const timer =
      setInterval(() => {
        const bot =
          selectedBotRef.current;

        if (
          !bot ||
          !chartMountedRef.current
        ) {
          return;
        }

        loadBotChart(
          bot,
          true
        );

        // ------------------------------------------------------
        // Refresh backend bot state.
        //
        // Keeps:
        //
        // - pyramid count
        // - trigger state
        // - trigger price
        // - bot status
        //
        // synchronized.
        // ------------------------------------------------------

        loadBots();
      }, REFRESH_INTERVAL);

    return () => {
      clearInterval(
        timer
      );
    };
  }, []);

  // ============================================================
  // ENTER POSITION
  // ============================================================

  async function handleEnterPosition() {
    if (
      !selectedBot
    ) {
      return;
    }

    // ----------------------------------------------------------
    // TRIGGER SAFETY BLOCK
    // ----------------------------------------------------------

    if (
      botIsNeutral
    ) {
      setMessage(
        "ENTRY BLOCKED — Bot is NEUTRAL. Trigger Line has not been activated."
      );

      return;
    }

    // ----------------------------------------------------------
    // PYRAMID SAFETY BLOCK
    // ----------------------------------------------------------

    if (
      pyramidReachedMax
    ) {
      setMessage(
        `ENTRY BLOCKED — Pyramid maximum reached (${pyramidCurrent}/${pyramidMax}).`
      );

      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setMessage("");

      const result =
        await enterBot(
          selectedBot.id
        );

      // --------------------------------------------------------
      // Refresh backend state.
      // --------------------------------------------------------

      const refreshedBots =
        await loadBots();

      // --------------------------------------------------------
      // Find refreshed bot.
      // --------------------------------------------------------

      const refreshedBot =
        refreshedBots.find(
          (bot) =>
            bot.id ===
            selectedBot.id
        );

      const markerNumber =
        Number(
          refreshedBot?.currentPositionCount ??
          pyramidCurrent + 1
        );

      addEntryMarker(
        selectedBot.direction,
        markerNumber
      );

      setMessage(
        result.message ||
          `${selectedBot.direction} position opened. TP/SL will be added in 30 seconds.`
      );

    } catch (err) {
      console.error(
        "[Chart Bot] Entry error:",
        err
      );

      setError(
        err.message ||
        "Entry failed."
      );

    } finally {
      setActionLoading(false);
    }
  }

  // ============================================================
  // CLOSE POSITION
  // ============================================================

  async function handleClosePosition() {
    if (
      !selectedBot
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setMessage("");

      const result =
        await closeBot(
          selectedBot.id
        );

      // --------------------------------------------------------
      // Clear markers.
      // --------------------------------------------------------

      clearEntryMarkers();

      // --------------------------------------------------------
      // Refresh backend state.
      // --------------------------------------------------------

      await loadBots();

      setMessage(
        result.message ||
          "Position closed."
      );

    } catch (err) {
      console.error(
        "[Chart Bot] Close error:",
        err
      );

      setError(
        err.message ||
        "Close failed."
      );

    } finally {
      setActionLoading(false);
    }
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="chart-bot-page">

      {/* ======================================================
          HEADER + SELECTOR
          ====================================================== */}

      <div className="chart-bot-header">

        <div>
          <h1>
            📈 CHART BOT
          </h1>

          <div className="chart-bot-symbol">
            {selectedBot
              ? selectedBot.symbol
              : "No bot selected"}
          </div>
        </div>

        <div className="chart-bot-selector">

          <label>
            SELECT BOT
          </label>

          <select
            value={
              selectedBotId
            }
            onChange={
              (event) =>
                setSelectedBotId(
                  event.target.value
                )
            }
            disabled={
              loadingBots ||
              bots.length ===
                0
            }
          >
            {loadingBots && (
              <option>
                Loading bots...
              </option>
            )}

            {!loadingBots &&
              bots.length ===
                0 && (
                <option>
                  No bots created
                </option>
              )}

            {bots.map(
              (bot) => (
                <option
                  key={
                    bot.id
                  }
                  value={
                    bot.id
                  }
                >
                  {bot.name}
                </option>
              )
            )}
          </select>

        </div>

      </div>

      {/* ======================================================
          ERROR
          ====================================================== */}

      {error && (
        <div className="chart-bot-error">
          {error}
        </div>
      )}

      {/* ======================================================
          MESSAGE
          ====================================================== */}

      {message && (
        <div className="chart-bot-success">
          {message}
        </div>
      )}

      {/* ======================================================
          CHART
          ====================================================== */}

      <div className="chart-card">

        <div className="chart-card-header">

          <div>
            {selectedBot
              ? `${selectedBot.name} — ${selectedBot.symbol}`
              : "Chart"}
          </div>

          <div className="chart-refresh-status">
            {chartLoading
              ? "Updating..."
              : "Updates every 30s"}
          </div>

        </div>

        <div
          className="chart-container"
          ref={
            chartContainerRef
          }
        />

      </div>

      {/* ======================================================
          BOT INFORMATION
          ====================================================== */}

      {selectedBot && (
        <div className="bot-info-card">

          <table className="bot-info-table">

            <tbody>

              {/* BOT NAME */}

              <tr>
                <td>
                  Bot Name
                </td>

                <td>
                  {selectedBot.name}
                </td>
              </tr>

              {/* DIRECTION */}

              <tr>
                <td>
                  Direction
                </td>

                <td>
                  {selectedBot.direction}
                </td>
              </tr>

              {/* ENTRY METHOD */}

              <tr>
                <td>
                  Entry Method
                </td>

                <td>
                  Button Press
                </td>
              </tr>

              {/* STOP LOSS */}

              <tr>
                <td>
                  Stop Loss
                </td>

                <td>
                  {selectedBot.stopLoss}%
                </td>
              </tr>

              {/* TAKE PROFIT */}

              <tr>
                <td>
                  Take Profit
                </td>

                <td>
                  {selectedBot.takeProfit}%
                </td>
              </tr>

              {/* TRIGGER LINE */}

              <tr>
                <td>
                  Trigger Line
                </td>

                <td>
                  {triggerLineEnabled
                    ? `ON — ${triggerLinePrice}`
                    : "OFF"}
                </td>
              </tr>

              {/* TRIGGER STATUS */}

              <tr>
                <td>
                  Trigger Status
                </td>

                <td>
                  <strong>
                    {triggerState}
                  </strong>
                </td>
              </tr>

              {/* PYRAMID */}

              <tr>
                <td>
                  Pyramid
                </td>

                <td>

                  <table
                    style={{
                      width:
                        "100%",

                      borderCollapse:
                        "collapse",
                    }}
                  >

                    <tbody>

                      <tr>
                        <td>
                          Entries
                        </td>

                        <td
                          style={{
                            textAlign:
                              "right",

                            fontWeight:
                              "bold",
                          }}
                        >
                          {pyramidCurrent}
                          {" / "}
                          {pyramidMax}
                        </td>
                      </tr>

                      <tr>
                        <td>
                          Remaining
                        </td>

                        <td
                          style={{
                            textAlign:
                              "right",

                            fontWeight:
                              "bold",
                          }}
                        >
                          {Math.max(
                            0,
                            pyramidMax -
                              pyramidCurrent
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td>
                          Status
                        </td>

                        <td
                          style={{
                            textAlign:
                              "right",

                            fontWeight:
                              "bold",
                          }}
                        >
                          {pyramidReachedMax
                            ? "MAX REACHED"
                            : "AVAILABLE"}
                        </td>
                      </tr>

                    </tbody>

                  </table>

                </td>
              </tr>

              {/* ENTER */}

              <tr>
                <td>
                  Enter
                </td>

                <td>

                  <button
                    type="button"
                    className="chart-bot-enter-button"
                    onClick={
                      handleEnterPosition
                    }
                    disabled={
                      enterBlocked
                    }
                  >
                    {actionLoading
                      ? "WORKING..."
                      : pyramidReachedMax
                        ? `PYRAMID FULL ${pyramidCurrent}/${pyramidMax}`
                        : botIsNeutral
                          ? "BLOCKED — NEUTRAL"
                          : `ENTER ${selectedBot.direction}`}
                  </button>

                </td>
              </tr>

              {/* CLOSE */}

              <tr>
                <td>
                  Close
                </td>

                <td>

                  <button
                    type="button"
                    className="chart-bot-close-button"
                    onClick={
                      handleClosePosition
                    }
                    disabled={
                      actionLoading
                    }
                  >
                    {actionLoading
                      ? "WORKING..."
                      : "CLOSE POSITION"}
                  </button>

                </td>
              </tr>

            </tbody>

          </table>

        </div>
      )}

    </div>
  );
}

export default ChartBot;