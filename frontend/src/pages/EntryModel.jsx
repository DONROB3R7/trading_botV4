import {
  useCallback,
  useEffect,
  useMemo,
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
  getEntryModelEngine,
  startEntryModelEngine,
  updateEntryModelEngine,
} from "../api";

import "./EntryModel.css";

/* ============================================================
   HELPERS
   ============================================================ */

function normalizeDirection(value) {
  const direction =
    String(value || "").toUpperCase();

  if (direction === "LONG") {
    return "LONG";
  }

  if (direction === "SHORT") {
    return "SHORT";
  }

  return "NEUTRAL";
}


function majorityDirection(
  scans,
  depth
) {
  let long = 0;
  let short = 0;

  for (const scan of scans) {
    const item =
      scan?.depths?.find(
        (depthItem) =>
          Number(depthItem.depth) ===
          Number(depth)
      );

    const direction =
      normalizeDirection(
        item?.direction
      );

    if (direction === "LONG") {
      long++;
    }

    if (direction === "SHORT") {
      short++;
    }
  }

  if (long > short) {
    return "LONG";
  }

  if (short > long) {
    return "SHORT";
  }

  return "NEUTRAL";
}


function normalizeCandle(candle) {
  if (!candle) {
    return null;
  }

  let time;
  let open;
  let high;
  let low;
  let close;

  if (Array.isArray(candle)) {
    time = Number(candle[0]);
    open = Number(candle[1]);
    high = Number(candle[2]);
    low = Number(candle[3]);
    close = Number(candle[4]);
  } else {
    time = Number(
      candle.time ??
      candle.timestamp ??
      candle.ts ??
      candle.openTime
    );

    open = Number(candle.open);
    high = Number(candle.high);
    low = Number(candle.low);
    close = Number(candle.close);
  }

  if (
    !Number.isFinite(time) ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close)
  ) {
    return null;
  }

  if (
    time >
    100000000000
  ) {
    time =
      Math.floor(
        time / 1000
      );
  }

  return {
    time,
    open,
    high,
    low,
    close,
  };
}


/* ============================================================
   TIMESTAMP HELPER
   ============================================================ */

function normalizeTimestamp(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value ===
    "number"
  ) {
    if (
      !Number.isFinite(
        value
      )
    ) {
      return null;
    }

    if (
      value >
      100000000000
    ) {
      return Math.floor(
        value / 1000
      );
    }

    return Math.floor(value);
  }

  const stringValue =
    String(value).trim();

  if (!stringValue) {
    return null;
  }

  const numericValue =
    Number(stringValue);

  if (
    Number.isFinite(
      numericValue
    )
  ) {
    if (
      numericValue >
      100000000000
    ) {
      return Math.floor(
        numericValue / 1000
      );
    }

    return Math.floor(
      numericValue
    );
  }

  const parsed =
    Date.parse(
      stringValue
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return null;
  }

  return Math.floor(
    parsed / 1000
  );
}


/* ============================================================
   PERCENTAGE FORMAT
   ============================================================ */

function formatPercentage(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "";
  }

  return `${number.toFixed(2)}%`;
}


/* ============================================================
   COMPONENT
   ============================================================ */

export default function EntryModel() {
  const [
    bots,
    setBots,
  ] = useState([]);

  const [
    selectedBotId,
    setSelectedBotId,
  ] = useState("");

  const [
    chartData,
    setChartData,
  ] = useState([]);

  const [
    previousCycles,
    setPreviousCycles,
  ] = useState([]);

  const [
    currentScans,
    setCurrentScans,
  ] = useState([]);

  const [
    scanCount,
    setScanCount,
  ] = useState(0);

  const [
    loadingBots,
    setLoadingBots,
  ] = useState(true);

  const [
    loadingChart,
    setLoadingChart,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");


  /* ==========================================================
     CHART REFS
     ========================================================== */

  const chartContainerRef =
    useRef(null);

  const chartRef =
    useRef(null);

  const candleSeriesRef =
    useRef(null);

  const markersRef =
    useRef(null);

  const chartMountedRef =
    useRef(false);

  const chartGenerationRef =
    useRef(0);

  const chartHasFittedRef =
    useRef(false);


  /* ==========================================================
     SERVER ENGINE
     ========================================================== */

  const chartRefreshTimerRef =
    useRef(null);

  /*
   * Prevent overlapping engine connection
   * requests when bot state changes quickly.
   */
  const engineConnectionRef =
    useRef(0);


  /* ==========================================================
     SELECTED BOT
     ========================================================== */

  const selectedBot =
    useMemo(() => {
      return bots.find(
        (bot) =>
          String(bot.id) ===
          String(selectedBotId)
      );
    }, [
      bots,
      selectedBotId,
    ]);


  const botDirection =
    normalizeDirection(
      selectedBot?.direction
    );

  console.log(
    "[Entry Model] SELECTED BOT DATA:",
    selectedBot
  );

  console.log(
    "[Entry Model] BOT DIRECTION RAW:",
    selectedBot?.direction,
    "| NORMALIZED:",
    botDirection
  );


  const triggerState =
    String(
      selectedBot?.triggerState ||
      ""
    ).toUpperCase();


  const isArmed =
    triggerState ===
    "ARMED";


  /* ==========================================================
     LOAD BOTS
     ========================================================== */

  const loadBots =
    useCallback(
      async () => {
        try {
          setLoadingBots(
            true
          );

          setError("");

          const response =
            await getBots();

          const list =
            Array.isArray(
              response
            )
              ? response
              : Array.isArray(
                  response?.bots
                )
              ? response.bots
              : Array.isArray(
                  response?.data
                )
              ? response.data
              : [];

          setBots(list);

          if (
            list.length > 0
          ) {
            setSelectedBotId(
              (current) => {
                if (
                  current &&
                  list.some(
                    (bot) =>
                      String(
                        bot.id
                      ) ===
                      String(
                        current
                      )
                  )
                ) {
                  return current;
                }

                return String(
                  list[0].id
                );
              }
            );
          } else {
            setSelectedBotId("");
          }

        } catch (err) {
          console.error(
            "[Entry Model] Bot load error:",
            err
          );

          setError(
            err?.message ||
            "Failed to load bots."
          );

        } finally {
          setLoadingBots(
            false
          );
        }
      },
      []
    );


  /* ==========================================================
     INITIAL LOAD / CLEANUP
     ========================================================== */

  useEffect(() => {
    loadBots();

    return () => {
      if (
        chartRefreshTimerRef.current
      ) {
        clearInterval(
          chartRefreshTimerRef.current
        );

        chartRefreshTimerRef.current =
          null;
      }
    };
  }, [
    loadBots,
  ]);


  /* ==========================================================
     LOAD CHART DATA
     ========================================================== */

  const loadChartData =
    useCallback(
      async (
        showLoading = true
      ) => {
        const symbol =
          selectedBot?.symbol;

        if (!symbol) {
          setChartData([]);

          return;
        }

        try {
          if (
            showLoading
          ) {
            setLoadingChart(
              true
            );
          }

          const response =
            await getChart(
              symbol,
              "15m"
            );

          const rawData =
            Array.isArray(
              response
            )
              ? response
              : Array.isArray(
                  response?.data
                )
              ? response.data
              : Array.isArray(
                  response?.candles
                )
              ? response.candles
              : Array.isArray(
                  response?.klines
                )
              ? response.klines
              : [];

          const normalized =
            rawData
              .map(
                normalizeCandle
              )
              .filter(Boolean)
              .sort(
                (a, b) =>
                  a.time -
                  b.time
              );

          setChartData(
            normalized
          );

          console.log(
            `[Entry Model] Chart refreshed | ${symbol} | candles=${normalized.length}`
          );

        } catch (err) {
          console.error(
            "[Entry Model] Chart load error:",
            err
          );

          setError(
            err?.message ||
            "Failed to load chart."
          );

        } finally {
          if (
            showLoading
          ) {
            setLoadingChart(
              false
            );
          }
        }
      },
      [
        selectedBot?.symbol,
      ]
    );


  /* ==========================================================
     INITIAL CHART DATA LOAD
     ========================================================== */

  useEffect(() => {
    let cancelled =
      false;

    async function initialLoad() {
      const symbol =
        selectedBot?.symbol;

      if (!symbol) {
        setChartData([]);

        return;
      }

      try {
        setLoadingChart(
          true
        );

        setError("");

        const response =
          await getChart(
            symbol,
            "15m"
          );

        if (
          cancelled
        ) {
          return;
        }

        const rawData =
          Array.isArray(
            response
          )
            ? response
            : Array.isArray(
                response?.data
              )
            ? response.data
            : Array.isArray(
                response?.candles
              )
            ? response.candles
            : Array.isArray(
                response?.klines
              )
            ? response.klines
            : [];

        const normalized =
          rawData
            .map(
              normalizeCandle
            )
            .filter(Boolean)
            .sort(
              (a, b) =>
                a.time -
                b.time
            );

        setChartData(
          normalized
        );

        console.log(
          `[Entry Model] Initial chart load | ${symbol} | candles=${normalized.length}`
        );

      } catch (err) {
        if (
          cancelled
        ) {
          return;
        }

        console.error(
          "[Entry Model] Chart load error:",
          err
        );

        setChartData([]);

        setError(
          err?.message ||
          "Failed to load chart."
        );

      } finally {
        if (
          !cancelled
        ) {
          setLoadingChart(
            false
          );
        }
      }
    }

    initialLoad();

    return () => {
      cancelled =
        true;
    };
  }, [
    selectedBot?.symbol,
  ]);


  /* ==========================================================
     ONE-MINUTE CHART REFRESH
     ========================================================== */

  useEffect(() => {
    if (
      chartRefreshTimerRef.current
    ) {
      clearInterval(
        chartRefreshTimerRef.current
      );

      chartRefreshTimerRef.current =
        null;
    }

    if (
      !selectedBot?.symbol
    ) {
      return;
    }

    chartRefreshTimerRef.current =
      setInterval(
        () => {
          loadChartData(
            false
          );
        },
        60 * 1000
      );

    return () => {
      if (
        chartRefreshTimerRef.current
      ) {
        clearInterval(
          chartRefreshTimerRef.current
        );

        chartRefreshTimerRef.current =
          null;
      }
    };
  }, [
    selectedBot?.symbol,
    loadChartData,
  ]);


  /* ==========================================================
     CREATE CHART

     IMPORTANT:
     The chart container ALWAYS exists in JSX.
     We do not wait for chartData/loading state.
     ========================================================== */

  useEffect(() => {
    const container =
      chartContainerRef.current;

    if (!container) {
      console.log(
        "[Entry Model] Chart container not ready"
      );

      return;
    }

    if (
      !selectedBot?.symbol
    ) {
      return;
    }

    if (
      chartRef.current
    ) {
      return;
    }

    chartGenerationRef.current +=
      1;

    const generation =
      chartGenerationRef.current;

    const chart =
      createChart(
        container,
        {
          width:
            container.clientWidth,

          height:
            600,

          layout: {
            background: {
              color:
                "#0d1728",
            },

            textColor:
              "#94a3b8",
          },

          grid: {
            vertLines: {
              color:
                "#17263d",
            },

            horzLines: {
              color:
                "#17263d",
            },
          },

          rightPriceScale: {
            borderColor:
              "#294467",
          },

          timeScale: {
            borderColor:
              "#294467",

            timeVisible:
              true,

            secondsVisible:
              false,
          },

          crosshair: {
            vertLine: {
              color:
                "#294467",
            },

            horzLine: {
              color:
                "#294467",
            },
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

    chartRef.current =
      chart;

    candleSeriesRef.current =
      candleSeries;

    markersRef.current =
      markerController;

    chartMountedRef.current =
      true;

    chartHasFittedRef.current =
      false;

    console.log(
      `[Entry Model] Chart created | ${selectedBot.symbol} | generation=${generation}`
    );


    /* --------------------------------------------------------
       RESIZE
       -------------------------------------------------------- */

    const handleResize =
      () => {
        if (
          !chartMountedRef.current ||
          !chartContainerRef.current
        ) {
          return;
        }

        try {
          chart.applyOptions({
            width:
              chartContainerRef.current
                .clientWidth,
          });
        } catch (error) {
          console.warn(
            "[Entry Model] Chart resize failed:",
            error
          );
        }
      };


    window.addEventListener(
      "resize",
      handleResize
    );


    /* --------------------------------------------------------
       CLEANUP
       -------------------------------------------------------- */

    return () => {
      console.log(
        `[Entry Model] Destroying chart | generation=${generation}`
      );

      chartMountedRef.current =
        false;

      chartGenerationRef.current +=
        1;

      window.removeEventListener(
        "resize",
        handleResize
      );

      try {
        chart.remove();
      } catch (error) {
        console.warn(
          "[Entry Model] Chart cleanup failed:",
          error
        );
      }

      chartRef.current =
        null;

      candleSeriesRef.current =
        null;

      markersRef.current =
        null;
    };
  }, [
    selectedBot?.symbol,
  ]);


  /* ==========================================================
     UPDATE CANDLE DATA
     ========================================================== */

  useEffect(() => {
    if (
      !chartMountedRef.current ||
      !candleSeriesRef.current
    ) {
      return;
    }

    if (
      !chartData.length
    ) {
      return;
    }

    try {
      candleSeriesRef.current.setData(
        chartData
      );

      console.log(
        `[Entry Model] Candles rendered | ${chartData.length}`
      );

    } catch (error) {
      console.error(
        "[Entry Model] Candle setData error:",
        error
      );
    }

  }, [
    chartData,
  ]);


  /* ==========================================================
     FIT CHART AFTER FIRST DATA LOAD
     ========================================================== */

  useEffect(() => {
    if (
      !chartMountedRef.current ||
      !chartRef.current ||
      !chartData.length
    ) {
      return;
    }

    if (
      chartHasFittedRef.current
    ) {
      return;
    }

    try {
      chartRef.current
        .timeScale()
        .fitContent();

      chartHasFittedRef.current =
        true;

    } catch (error) {
      console.warn(
        "[Entry Model] Chart fit failed:",
        error
      );
    }

  }, [
    chartData,
  ]);


  /* ==========================================================
     ADD FINAL SIGNAL MARKERS
     ========================================================== */

  useEffect(() => {
    if (
      !chartMountedRef.current ||
      !candleSeriesRef.current ||
      !markersRef.current ||
      !chartData.length
    ) {
      return;
    }

    const markers = [];

    /* --------------------------------------------------------
       BUILD MARKERS FROM COMPLETED CYCLES
       -------------------------------------------------------- */

    for (
      const cycle of previousCycles
    ) {
      const decision =
        normalizeDirection(
          cycle?.decision
        );

      /*
       * NEUTRAL = NO MARKER
       */

      if (
        decision !== "LONG" &&
        decision !== "SHORT"
      ) {
        continue;
      }

      const cycleTime =
        normalizeTimestamp(
          cycle?.timestamp
        );

      if (
        !Number.isFinite(
          cycleTime
        )
      ) {
        console.warn(
          "[Entry Model] Invalid cycle marker timestamp:",
          cycle?.timestamp
        );

        continue;
      }

      /* ------------------------------------------------------
         FIND CLOSEST CANDLE
         ------------------------------------------------------ */

      let nearestCandle =
        chartData[0];

      let nearestDistance =
        Math.abs(
          chartData[0].time -
            cycleTime
        );

      for (
        const candle of chartData
      ) {
        const distance =
          Math.abs(
            candle.time -
              cycleTime
          );

        if (
          distance <
          nearestDistance
        ) {
          nearestDistance =
            distance;

          nearestCandle =
            candle;
        }
      }

      markers.push({
        time:
          nearestCandle.time,

        position:
          decision === "LONG"
            ? "belowBar"
            : "aboveBar",

        color:
          decision === "LONG"
            ? "#22c55e"
            : "#ef4444",

        shape:
          "circle",

        text:
          decision,
      });
    }

    markers.sort(
      (a, b) =>
        a.time - b.time
    );

    /* --------------------------------------------------------
       UPDATE EXISTING MARKER CONTROLLER
       -------------------------------------------------------- */

    try {
      markersRef.current.setMarkers(
        markers
      );
    } catch (error) {
      console.warn(
        "[Entry Model] Marker update failed:",
        error
      );
    }

  }, [
    previousCycles,
    chartData,
  ]);


  /* ==========================================================
     SERVER ENTRY MODEL ENGINE
     ========================================================== */

  useEffect(() => {
    if (!selectedBot) {
      return;
    }

    /*
     * Every time the selected bot / direction /
     * trigger changes, create a new connection
     * generation.
     *
     * This prevents an older async request from
     * overwriting newer bot state.
     */
    engineConnectionRef.current += 1;

    const connectionId =
      engineConnectionRef.current;

    let cancelled = false;

    async function connectEngine() {
      try {
        console.log(
          `[Entry Model] ENGINE CHECK | ${selectedBot.id} | Trigger=${triggerState}`
        );

        const status =
          await getEntryModelEngine(
            selectedBot.id
          );

        if (
          cancelled ||
          connectionId !==
            engineConnectionRef.current
        ) {
          return;
        }

        /* ----------------------------------------------------
           NOT ARMED
           ---------------------------------------------------- */

        if (!isArmed) {
          console.log(
            `[Entry Model] ENGINE UPDATE | ${selectedBot.id} | Trigger=${triggerState || "UNKNOWN"}`
          );

          /*
           * IMPORTANT:
           * Do NOT simply return here.
           *
           * This update tells the server engine:
           *
           * ARMED -> NEUTRAL
           *
           * and the backend stops the timer.
           */
          if (
            status?.exists
          ) {
            await updateEntryModelEngine(
              selectedBot.id,
              selectedBot.symbol,
              botDirection,
              triggerState
            );

            console.log(
              `[Entry Model] ENGINE STOPPED BY TRIGGER | ${selectedBot.id}`
            );
          }

          return;
        }

        /* ----------------------------------------------------
           ARMED + ENGINE DOES NOT EXIST
           ---------------------------------------------------- */

        if (
          !status?.exists
        ) {
          console.log(
            `[Entry Model] STARTING SERVER ENGINE | ${selectedBot.id}`
          );

          const started =
            await startEntryModelEngine(
              selectedBot.id,
              selectedBot.symbol,
              botDirection,
              triggerState
            );

          if (
            cancelled ||
            connectionId !==
              engineConnectionRef.current
          ) {
            return;
          }

          console.log(
            `[Entry Model] SERVER ENGINE STARTED | ${selectedBot.id} | Scan=${started?.status?.scanCount ?? 0}/10`
          );

          return;
        }

        /* ----------------------------------------------------
           ARMED + ENGINE EXISTS
           ---------------------------------------------------- */

        console.log(
          `[Entry Model] ENGINE EXISTS | ${selectedBot.id} | Running=${status.running} | Cycle=${status.cycleNumber} | Scans=${status.scanCount}/10`
        );

        /*
         * Update symbol / direction / trigger.
         *
         * This does NOT reset cycleScans.
         */
        const updated =
          await updateEntryModelEngine(
            selectedBot.id,
            selectedBot.symbol,
            botDirection,
            triggerState
          );

        if (
          cancelled ||
          connectionId !==
            engineConnectionRef.current
        ) {
          return;
        }

        /*
         * Existing engine is stopped but the bot
         * is ARMED.
         *
         * Resume it.
         */
        if (
          !status.running
        ) {
          console.log(
            `[Entry Model] STARTING STOPPED ENGINE | ${selectedBot.id}`
          );

          await startEntryModelEngine(
            selectedBot.id,
            selectedBot.symbol,
            botDirection,
            triggerState
          );

          console.log(
            `[Entry Model] SERVER ENGINE RESUMED | ${selectedBot.id}`
          );
        }

      } catch (err) {
        console.error(
          "[Entry Model] Engine connection error:",
          err
        );

        if (
          !cancelled &&
          connectionId ===
            engineConnectionRef.current
        ) {
          setError(
            err?.message ||
            "Failed to connect Entry Model engine."
          );
        }
      }
    }

    connectEngine();

    return () => {
      cancelled = true;
    };
  }, [
    selectedBotId,
    isArmed,
    botDirection,
    triggerState,
  ]);


  /* ==========================================================
     LOAD SERVER ENGINE STATE
     ========================================================== */

  useEffect(() => {
    if (!selectedBot) {
      setCurrentScans([]);
      setScanCount(0);
      setPreviousCycles([]);

      return;
    }

    let cancelled = false;

    async function loadEngineState() {
      try {
        const status =
          await getEntryModelEngine(
            selectedBot.id
          );

        if (cancelled) {
          return;
        }

const scans =
  Array.isArray(
    status?.currentScans
  )
    ? status.currentScans.map(
        (scan) => ({
          ...scan,

          timestamp:
            scan?.timestamp ||
            scan?.scannedAt ||
            null,
        })
      )
    : [];

const cycles =
  Array.isArray(
    status?.previousCycles
  )
    ? status.previousCycles.map(
        (cycle, index) => ({
          ...cycle,

          id:
            cycle?.id ||
            `${cycle?.botId || selectedBot.id}-${cycle?.cycleNumber || index}`,

          timestamp:
            cycle?.timestamp ||
            cycle?.completedAt ||
            null,

          votes:
            Number(
              cycle?.votes ??
              cycle?.botDirectionVotes ??
              0
            ),
        })
      )
    : [];

console.log(
  "[Entry Model] SERVER STATE:",
  {
    botId:
      selectedBot.id,

    exists:
      status?.exists,

    running:
      status?.running,

    cycleNumber:
      status?.cycleNumber,

    scanCount:
      status?.scanCount,

    currentScans:
      scans.length,

    previousCycles:
      cycles.length,
  }
);

setCurrentScans(
  scans
);

setScanCount(
  Number(
    status?.scanCount || 0
  )
);

setPreviousCycles(
  cycles
);

      } catch (err) {
        console.error(
          "[Entry Model] Engine status error:",
          err
        );
      }
    }

    /*
     * Load immediately.
     */
    loadEngineState();

    /*
     * Keep React synchronized with
     * the server every 3 seconds.
     */
    const timer =
      setInterval(
        loadEngineState,
        3000
      );

    return () => {
      cancelled = true;

      clearInterval(
        timer
      );
    };
  }, [
    selectedBotId,
  ]);


  /* ==========================================================
     BOT CHANGE
     ========================================================== */

  const handleBotChange =
    (event) => {
      const value =
        event.target.value;

      setSelectedBotId(
        value
      );

      /*
       * Clear the screen temporarily.
       *
       * IMPORTANT:
       * This does NOT reset the server engine.
       *
       * The server state will be loaded
       * immediately after the bot changes.
       */
      setCurrentScans(
        []
      );

      setScanCount(
        0
      );

      setPreviousCycles(
        []
      );

      setError("");

      setSuccess("");
    };


  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="entry-model-page">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="entry-model-header">

        <div>

          <h1>
            Entry Model
          </h1>

          {selectedBot && (
            <div className="entry-model-symbol">
              {selectedBot.symbol}
            </div>
          )}

        </div>


        <div className="entry-model-selector">

          <label>
            BOT
          </label>

          <select
            value={
              selectedBotId
            }
            onChange={
              handleBotChange
            }
            disabled={
              loadingBots
            }
          >

            <option value="">
              Select Bot
            </option>

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
                  {bot.name ||
                    bot.id ||
                    bot.symbol}
                  {" | "}
                  {bot.symbol}
                  {" | "}
                  {normalizeDirection(
                    bot.direction
                  )}
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
        <div className="entry-model-error">
          {error}
        </div>
      )}


      {/* ======================================================
          SUCCESS
          ====================================================== */}

      {success && (
        <div className="entry-model-success">
          {success}
        </div>
      )}


      {/* ======================================================
          STATUS
          ====================================================== */}

      <div className="entry-model-status">

        <div className="entry-model-status-left">

          <span className="entry-model-status-label">
            Bot:
          </span>

          <span className="entry-model-status-value">
            {selectedBot?.symbol ||
              "NONE"}
          </span>


          <span className="entry-model-status-label">
            Direction:
          </span>

          <span className="entry-model-status-value">
            {selectedBot
              ? botDirection
              : "NONE"}
          </span>


          <span className="entry-model-status-label">
            Trigger:
          </span>

          <span
            className={`entry-model-status-value ${
              isArmed
                ? "armed"
                : "neutral"
            }`}
          >
            {selectedBot
              ? triggerState
              : "NONE"}
          </span>

        </div>

      </div>


      {/* ======================================================
          SCAN INFO
          ====================================================== */}

      <div className="entry-model-scan-info">

        <div className="entry-model-scan-info-left">

          <span className="entry-model-scan-label">
            Current Cycle
          </span>

          <span className="entry-model-scan-count">
            {scanCount} / 10
          </span>

        </div>


        <div className="entry-model-scan-message">

          {isArmed
            ? "Orderbook scan running every 1 minute"
            : "Waiting for bot to become ARMED"}

        </div>

      </div>


      {/* ======================================================
          CHART
          ====================================================== */}

      <div className="entry-model-chart-card">

        <div className="entry-model-section-header">

          <h2 className="entry-model-section-title">

            {selectedBot?.symbol ||
              "Chart"}

            {" | "}

            15m

          </h2>


          <span className="entry-model-chart-info">

            {loadingChart
              ? "Loading..."
              : chartData.length > 0
                ? `${chartData.length} candles`
                : "No chart data"}

          </span>

        </div>


        {/* ----------------------------------------------------
           IMPORTANT:
           CHART CONTAINER ALWAYS EXISTS.
           ---------------------------------------------------- */}

        <div
          ref={
            chartContainerRef
          }
          className="entry-model-chart"
        />

        {!chartData.length &&
          !loadingChart && (
            <div className="entry-model-chart-empty">
              No chart data available
            </div>
          )}

      </div>


      {/* ======================================================
          CURRENT CYCLE
          ====================================================== */}

      <div className="entry-model-table-card">

        <div className="entry-model-table-header">

          <h2 className="entry-model-table-title">
            CURRENT CYCLE
          </h2>

          <span className="entry-model-cycle-count">
            {scanCount} / 10
          </span>

        </div>


        <div className="entry-model-table-wrapper">

          <table className="entry-model-table">

            <thead>

              <tr>

                <th>
                  Time
                </th>

                <th>
                  Coin
                </th>

                <th>
                  Trend 15
                </th>

                <th>
                  Trend 20
                </th>

                <th>
                  Trend 30
                </th>

                <th>
                  Trend 60
                </th>

                <th>
                  Decision
                </th>

              </tr>

            </thead>


            <tbody>

              {currentScans.length === 0 ? (

                <tr>

                  <td
                    colSpan="7"
                    className="entry-model-empty"
                  >
                    No scans yet.
                    <br />
                    Waiting for the next
                    orderbook scan.
                  </td>

                </tr>

              ) : (

                currentScans.map(
                  (
                    scan,
                    index
                  ) => {

                    const depth15 =
                      scan?.depths?.find(
                        (item) =>
                          Number(
                            item.depth
                          ) ===
                          15
                      );

                    const depth20 =
                      scan?.depths?.find(
                        (item) =>
                          Number(
                            item.depth
                          ) ===
                          20
                      );

                    const depth30 =
                      scan?.depths?.find(
                        (item) =>
                          Number(
                            item.depth
                          ) ===
                          30
                      );

                    const depth60 =
                      scan?.depths?.find(
                        (item) =>
                          Number(
                            item.depth
                          ) ===
                          60
                      );

                    const time =
                      scan?.timestamp
                        ? new Date(
                            scan.timestamp
                          ).toLocaleTimeString()
                        : "--:--:--";

                    return (
                      <tr
                        key={
                          scan?.timestamp ||
                          index
                        }
                      >

                        <td>
                          {time}
                        </td>

                        <td>
                          {scan?.symbol ||
                            selectedBot?.symbol ||
                            "-"}
                        </td>

                        <td>
                          <span
                            className={`entry-model-direction ${
                              String(
                                depth15?.direction ||
                                "NEUTRAL"
                              ).toLowerCase()
                            }`}
                          >
                            {normalizeDirection(
                              depth15?.direction
                            )}

                            {formatPercentage(
                              depth15?.percentage
                            ) && (
                              <>
                                {" "}
                                {formatPercentage(
                                  depth15?.percentage
                                )}
                              </>
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`entry-model-direction ${
                              String(
                                depth20?.direction ||
                                "NEUTRAL"
                              ).toLowerCase()
                            }`}
                          >
                            {normalizeDirection(
                              depth20?.direction
                            )}

                            {formatPercentage(
                              depth20?.percentage
                            ) && (
                              <>
                                {" "}
                                {formatPercentage(
                                  depth20?.percentage
                                )}
                              </>
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`entry-model-direction ${
                              String(
                                depth30?.direction ||
                                "NEUTRAL"
                              ).toLowerCase()
                            }`}
                          >
                            {normalizeDirection(
                              depth30?.direction
                            )}

                            {formatPercentage(
                              depth30?.percentage
                            ) && (
                              <>
                                {" "}
                                {formatPercentage(
                                  depth30?.percentage
                                )}
                              </>
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`entry-model-direction ${
                              String(
                                depth60?.direction ||
                                "NEUTRAL"
                              ).toLowerCase()
                            }`}
                          >
                            {normalizeDirection(
                              depth60?.direction
                            )}

                            {formatPercentage(
                              depth60?.percentage
                            ) && (
                              <>
                                {" "}
                                {formatPercentage(
                                  depth60?.percentage
                                )}
                              </>
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`entry-model-decision ${
                              String(
                                scan?.decision ||
                                "NEUTRAL"
                              ).toLowerCase()
                            }`}
                          >
                            {normalizeDirection(
                              scan?.decision
                            )}
                          </span>
                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>

      </div>


      {/* ======================================================
          PREVIOUS CYCLES
          ====================================================== */}

      <div className="entry-model-table-card">

        <div className="entry-model-table-header">

          <h2 className="entry-model-table-title">
            PREVIOUS CYCLES
          </h2>

          <span className="entry-model-cycle-count">
            {previousCycles.length} completed
          </span>

        </div>


        <div className="entry-model-table-wrapper">

          <table className="entry-model-table">

            <thead>

              <tr>

                <th>
                  Time
                </th>

                <th>
                  Coin
                </th>

                <th>
                  Bot
                </th>

                <th>
                  Trend 15
                </th>

                <th>
                  Trend 20
                </th>

                <th>
                  Trend 30
                </th>

                <th>
                  Trend 60
                </th>

                <th>
                  Votes
                </th>

                <th>
                  Scans
                </th>

                <th>
                  Decision
                </th>

              </tr>

            </thead>


            <tbody>

              {previousCycles.length === 0 ? (

                <tr>

                  <td
                    colSpan="10"
                    className="entry-model-empty"
                  >
                    No completed cycles yet.
                    <br />
                    The current cycle will move
                    here after 10 scans.
                  </td>

                </tr>

              ) : (

                previousCycles.map(
                  (
                    cycle
                  ) => (
                    <tr
                      key={
                        cycle.id
                      }
                    >

                      <td>
                        {new Date(
                          cycle.timestamp
                        ).toLocaleTimeString()}
                      </td>

                      <td>
                        {cycle.symbol}
                      </td>

                      <td>
                        <span
                          className={`entry-model-direction ${
                            String(
                              cycle.botDirection
                            ).toLowerCase()
                          }`}
                        >
                          {
                            cycle.botDirection
                          }
                        </span>
                      </td>

                      <td>
                        <span
                          className={`entry-model-direction ${
                            String(
                              cycle.trend15
                            ).toLowerCase()
                          }`}
                        >
                          {
                            cycle.trend15
                          }
                        </span>
                      </td>

                      <td>
                        <span
                          className={`entry-model-direction ${
                            String(
                              cycle.trend20
                            ).toLowerCase()
                          }`}
                        >
                          {
                            cycle.trend20
                          }
                        </span>
                      </td>

                      <td>
                        <span
                          className={`entry-model-direction ${
                            String(
                              cycle.trend30
                            ).toLowerCase()
                          }`}
                        >
                          {
                            cycle.trend30
                          }
                        </span>
                      </td>

                      <td>
                        <span
                          className={`entry-model-direction ${
                            String(
                              cycle.trend60
                            ).toLowerCase()
                          }`}
                        >
                          {
                            cycle.trend60
                          }
                        </span>
                      </td>

                      <td>
                        <span
                          className={`entry-model-votes ${
                            cycle.votes >=
                            6
                              ? "good"
                              : "bad"
                          }`}
                        >
                          {
                            cycle.votes
                          }{" "}
                          / 10
                        </span>
                      </td>

                      <td>
                        {
                          cycle.totalScans
                        }
                      </td>

                      <td>
                        <span
                          className={`entry-model-decision ${
                            String(
                              cycle.decision
                            ).toLowerCase()
                          }`}
                        >
                          {
                            cycle.decision
                          }
                        </span>
                      </td>

                    </tr>
                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}
