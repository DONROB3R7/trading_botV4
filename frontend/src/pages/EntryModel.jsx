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
  getCombinedEntryModel,
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


function normalizeTimestamp(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === "number"
  ) {
    if (!Number.isFinite(value)) {
      return null;
    }

    return value > 100000000000
      ? Math.floor(value / 1000)
      : Math.floor(value);
  }

  const numeric =
    Number(value);

  if (
    Number.isFinite(numeric)
  ) {
    return numeric > 100000000000
      ? Math.floor(numeric / 1000)
      : Math.floor(numeric);
  }

  const parsed =
    Date.parse(String(value));

  if (
    !Number.isFinite(parsed)
  ) {
    return null;
  }

  return Math.floor(parsed / 1000);
}


/* ============================================================
ORDERBOOK DEPTH HELPERS
============================================================ */

function getDepthResult(
  scan,
  depth,
  fallbackKey
) {
  /*
    Backend structure:

    currentCycleScans[]
      └── scan
           └── depths[]
                ├── depth 5
                ├── depth 10
                ├── depth 15
                └── depth 20
  */

  const depths =
    Array.isArray(
      scan?.scan?.depths
    )
      ? scan.scan.depths
      : [];

  const result =
    depths.find(
      (item) =>
        Number(item?.depth) ===
        Number(depth)
    );

  if (result) {
    return result;
  }

  /*
    Fallback for older data structure.
  */

  const oldDepths =
    Array.isArray(scan?.depths)
      ? scan.depths
      : [];

  const oldResult =
    oldDepths.find(
      (item) =>
        Number(item?.depth) ===
        Number(depth)
    );

  if (oldResult) {
    return oldResult;
  }

  return {
    direction:
      scan?.[fallbackKey] ||
      "NEUTRAL",

    percentage:
      scan?.[
        fallbackKey.replace(
          "trend",
          "percentage"
        )
      ] ??
      null,
  };
}


function getDepthDirection(
  scan,
  depth,
  fallbackKey
) {
  const result =
    getDepthResult(
      scan,
      depth,
      fallbackKey
    );

  return normalizeDirection(
    result?.direction
  );
}


function getDepthPercentage(
  scan,
  depth,
  fallbackKey
) {
  const result =
    getDepthResult(
      scan,
      depth,
      fallbackKey
    );

  if (
    result?.percentage === null ||
    result?.percentage === undefined
  ) {
    return null;
  }

  const value =
    Number(result.percentage);

  return Number.isFinite(value)
    ? value
    : null;
}


/* ============================================================
DEPTH PRICE RANGE
============================================================ */

function getDepthPriceRange(
  scan,
  depth,
  fallbackKey
) {
  const result =
    getDepthResult(
      scan,
      depth,
      fallbackKey
    );

  const priceRange =
    result?.priceRange;

  if (
    !priceRange
  ) {
    return null;
  }

  const low =
    Number(
      priceRange.low
    );

  const high =
    Number(
      priceRange.high
    );

  if (
    !Number.isFinite(low) ||
    !Number.isFinite(high)
  ) {
    return null;
  }

  return {
    low,
    high,
  };
}


/* ============================================================
RENDER DEPTH CELL
============================================================ */

function renderDepthCell(
  scan,
  depth,
  fallbackKey
) {
  const result =
    getDepthResult(
      scan,
      depth,
      fallbackKey
    );

  const direction =
    getDepthDirection(
      scan,
      depth,
      fallbackKey
    );

  const percentage =
    getDepthPercentage(
      scan,
      depth,
      fallbackKey
    );

  const imbalance =
    Number.isFinite(
      Number(result?.imbalance)
    )
      ? Number(result.imbalance)
      : null;

  const priceRange =
    getDepthPriceRange(
      scan,
      depth,
      fallbackKey
    );

  return (
    <div className="entry-model-depth-cell">

      {/* DIRECTION */}

      <span
        className={`entry-model-depth-direction ${direction.toLowerCase()}`}
      >
        {direction}
      </span>


      {/* PERCENTAGE */}

      {percentage !== null && (
        <span className="entry-model-depth-percentage">
          {percentage.toFixed(2)}%
        </span>
      )}


      {/* IMBALANCE */}

      {imbalance !== null && (
        <span className="entry-model-depth-imbalance">
          I: {imbalance.toFixed(4)}
        </span>
      )}


      {/* PRICE RANGE */}

      {priceRange && (
        <span className="entry-model-depth-price-range">

          <span>
            {priceRange.low}
          </span>

          <span>
            {" → "}
          </span>

          <span>
            {priceRange.high}
          </span>

        </span>
      )}

    </div>
  );
}


/* ============================================================
COMPONENT
============================================================ */

export default function EntryModel() {

  /* ==========================================================
  BOT STATE
  ========================================================== */

  const [
    bots,
    setBots,
  ] = useState([]);

  const [
    selectedBotId,
    setSelectedBotId,
  ] = useState("");


  /* ==========================================================
  CHART STATE
  ========================================================== */

  const [
    chartData,
    setChartData,
  ] = useState([]);

  const [
    loadingChart,
    setLoadingChart,
  ] = useState(false);


  /* ==========================================================
  COMBINED ENTRY MODEL STATE
  ========================================================== */

  const [
    combinedState,
    setCombinedState,
  ] = useState(null);


  /* ==========================================================
  GENERAL STATE
  ========================================================== */

  const [
    loadingBots,
    setLoadingBots,
  ] = useState(true);

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

  const chartRefreshTimerRef =
    useRef(null);


  /* ==========================================================
  SELECTED BOT
  ========================================================== */

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

  const botDirection =
    normalizeDirection(
      selectedBot?.direction
    );

  const triggerState =
    selectedBot?.triggerState || "";

  const isArmed =
    triggerState === "ARMED";

  const botStatus =
    selectedBot?.status || "";


  /* ==========================================================
  COMBINED STATE
  ========================================================== */

  const combinedRunning =
    Boolean(
      combinedState?.running
    );

  const combinedStateName =
    combinedState?.state ||
    "IDLE";

  const combinedDirection =
    normalizeDirection(
      combinedState?.direction
    );

  const orderbookCycle =
    Number(
      combinedState?.orderbookCycle || 0
    );

  const maxOrderbookCycles =
    Number(
      combinedState?.maxOrderbookCycles || 3
    );

  const orderbookScan =
    Number(
      combinedState?.orderbookScans || 0
    );

  const scansPerCycle =
    Number(
      combinedState?.scansPerCycle || 15
    );

  const confirmations =
    Number(
      combinedState?.confirmations || 0
    );

  const requiredConfirmations =
    Number(
      combinedState?.requiredConfirmations || 5
    );

  const pyramidCount =
    Number(
      combinedState?.pyramidCount || 0
    );

  const maxPyramid =
    Number(
      combinedState?.maxPyramid || 3
    );


  /* ==========================================================
  CURRENT SCANS
  ========================================================== */

  /*
    Backend is the source of truth.

    CombinedEntryModelController stores:

      currentCycleScans[]

    Actual structure:

      currentCycleScans[]
        └── scan
             ├── symbol
             ├── decision
             ├── directionConfirmed
             ├── confirmations
             └── depths[]
                  ├── depth 5
                  ├── depth 10
                  ├── depth 15
                  └── depth 20
  */

  const currentScans =
    useMemo(
      () => {

        const scans =
          Array.isArray(
            combinedState?.currentCycleScans
          )
            ? combinedState.currentCycleScans
            : [];

        return [...scans].sort(
          (a, b) => {

            const scanA =
              Number(
                a?.scanNumber || 0
              );

            const scanB =
              Number(
                b?.scanNumber || 0
              );

            return scanA - scanB;
          }
        );
      },
      [
        combinedState,
      ]
    );


  /* ==========================================================
  PREVIOUS CYCLES
  ========================================================== */

  const previousCycles =
    Array.isArray(
      combinedState?.previousCycles
    )
      ? combinedState.previousCycles
      : [];


  /* ==========================================================
  SORT PREVIOUS CYCLES
  ========================================================== */

  const sortedPreviousCycles =
    useMemo(
      () =>
        [...previousCycles].sort(
          (a, b) => {

            const timeA =
              normalizeTimestamp(
                a?.completedAt
              ) || 0;

            const timeB =
              normalizeTimestamp(
                b?.completedAt
              ) || 0;

            return timeB - timeA;
          }
        ),
      [
        previousCycles,
      ]
    );


  /* ==========================================================
  LOAD BOTS
  ========================================================== */

  const loadBots =
    useCallback(
      async () => {

        try {

          setLoadingBots(true);
          setError("");

          const response =
            await getBots();

          const list =
            Array.isArray(response)
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

          if (list.length > 0) {

            setSelectedBotId(
              (current) => {

                if (
                  current &&
                  list.some(
                    (bot) =>
                      String(bot.id) ===
                      String(current)
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

          setLoadingBots(false);

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
  LOAD COMBINED ENTRY MODEL
  ========================================================== */

  useEffect(() => {

    if (!selectedBot) {

      setCombinedState(null);

      return;

    }

    let cancelled = false;


    async function loadCombinedState() {

      try {

        const response =
          await getCombinedEntryModel(
            selectedBot.id
          );

        if (cancelled) {
          return;
        }

        const model =
          response?.model ??
          response?.data ??
          response;

        setCombinedState(
          model || null
        );

        console.log(
          "[Entry Model] COMBINED STATE:",
          model
        );

      } catch (err) {

        if (cancelled) {
          return;
        }

        console.error(
          "[Entry Model] Combined state error:",
          err
        );

        setError(
          err?.message ||
          "Failed to load Combined Entry Model."
        );

      }

    }


    loadCombinedState();


    /*
      Backend owns the timer.

      Frontend only reads the state.
      2-second polling is enough to display
      the 20-second scanner updates.
    */

    const timer =
      setInterval(
        loadCombinedState,
        2000
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

          if (showLoading) {
            setLoadingChart(true);
          }

          const response =
            await getChart(
              symbol,
              "15m"
            );

          const rawData =
            Array.isArray(response)
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
              .map((candle) => {

                if (!candle) {
                  return null;
                }

                let time;
                let open;
                let high;
                let low;
                let close;

                if (
                  Array.isArray(
                    candle
                  )
                ) {

                  time =
                    Number(
                      candle[0]
                    );

                  open =
                    Number(
                      candle[1]
                    );

                  high =
                    Number(
                      candle[2]
                    );

                  low =
                    Number(
                      candle[3]
                    );

                  close =
                    Number(
                      candle[4]
                    );

                } else {

                  time =
                    Number(
                      candle.time ??
                      candle.timestamp ??
                      candle.ts ??
                      candle.openTime
                    );

                  open =
                    Number(
                      candle.open
                    );

                  high =
                    Number(
                      candle.high
                    );

                  low =
                    Number(
                      candle.low
                    );

                  close =
                    Number(
                      candle.close
                    );

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

              })
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

          if (showLoading) {
            setLoadingChart(false);
          }

        }

      },
      [
        selectedBot?.symbol,
      ]
    );


  /* ==========================================================
  INITIAL CHART LOAD
  ========================================================== */

  useEffect(() => {

    let cancelled = false;


    async function initialLoad() {

      const symbol =
        selectedBot?.symbol;

      if (!symbol) {

        setChartData([]);

        return;

      }

      try {

        setLoadingChart(true);
        setError("");

        const response =
          await getChart(
            symbol,
            "15m"
          );

        if (cancelled) {
          return;
        }

        const rawData =
          Array.isArray(response)
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
            .map((candle) => {

              if (!candle) {
                return null;
              }

              let time;
              let open;
              let high;
              let low;
              let close;

              if (
                Array.isArray(
                  candle
                )
              ) {

                time =
                  Number(
                    candle[0]
                  );

                open =
                  Number(
                    candle[1]
                  );

                high =
                  Number(
                    candle[2]
                  );

                low =
                  Number(
                    candle[3]
                  );

                close =
                  Number(
                    candle[4]
                  );

              } else {

                time =
                  Number(
                    candle.time ??
                    candle.timestamp ??
                    candle.ts ??
                    candle.openTime
                  );

                open =
                  Number(
                    candle.open
                  );

                high =
                  Number(
                    candle.high
                  );

                low =
                  Number(
                    candle.low
                  );

                close =
                  Number(
                    candle.close
                  );

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

            })
            .filter(Boolean)
            .sort(
              (a, b) =>
                a.time -
                b.time
            );

        setChartData(
          normalized
        );

      } catch (err) {

        if (cancelled) {
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

        if (!cancelled) {
          setLoadingChart(false);
        }

      }

    }


    initialLoad();


    return () => {
      cancelled = true;
    };

  }, [
    selectedBot?.symbol,
  ]);


  /* ==========================================================
  CHART REFRESH
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
          loadChartData(false);
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
  ========================================================== */

  useEffect(() => {

    const container =
      chartContainerRef.current;

    if (!container) {
      return;
    }

    if (
      !selectedBot?.symbol
    ) {
      return;
    }

    if (chartRef.current) {
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


    return () => {

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
  UPDATE CANDLES
  ========================================================== */

  useEffect(() => {

    if (
      !chartMountedRef.current ||
      !candleSeriesRef.current ||
      !chartData.length
    ) {
      return;
    }

    try {

      candleSeriesRef.current.setData(
        chartData
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
  FIT CHART
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
  SIGNAL MARKERS
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

    for (
      const cycle
      of previousCycles
    ) {

      const decision =
        String(
          cycle?.decision || ""
        ).toUpperCase();

      if (
        decision !== "LONG" &&
        decision !== "SHORT"
      ) {
        continue;
      }

      const cycleTime =
        normalizeTimestamp(
          cycle?.completedAt
        );

      if (
        !Number.isFinite(
          cycleTime
        )
      ) {
        continue;
      }

      let nearestCandle =
        chartData[0];

      let nearestDistance =
        Math.abs(
          chartData[0].time -
          cycleTime
        );

      for (
        const candle
        of chartData
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
          decision === "LONG"
            ? "arrowUp"
            : "arrowDown",

        text:
          decision,

      });

    }


    markers.sort(
      (a, b) =>
        a.time -
        b.time
    );


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
  BOT CHANGE
  ========================================================== */

  const handleBotChange =
    (event) => {

      const value =
        event.target.value;

      setSelectedBotId(
        value
      );

      setCombinedState(
        null
      );

      setError("");

      setSuccess("");

    };


  /* ==========================================================
  RENDER
  ========================================================== */

  return (

    <div className="entry-model-page">

      {/* ====================================================
          HEADER
          ==================================================== */}

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

                  {bot.direction}

                </option>

              )
            )}

          </select>

        </div>

      </div>


      {/* ====================================================
          ERROR
          ==================================================== */}

      {error && (
        <div className="entry-model-error">
          {error}
        </div>
      )}


      {/* ====================================================
          STATUS
          ==================================================== */}

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
            {combinedDirection !== "NEUTRAL"
              ? combinedDirection
              : botDirection}
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


          <span className="entry-model-status-label">
            Bot Status:
          </span>

          <span className="entry-model-status-value">
            {botStatus ||
              "NONE"}
          </span>


          <span className="entry-model-status-label">
            Combined:
          </span>

          <span className="entry-model-status-value">
            {combinedRunning
              ? "RUNNING"
              : "STOPPED"}
          </span>

        </div>

      </div>


      {/* ====================================================
          COMBINED HUNT STATUS
          ==================================================== */}

      <div className="entry-model-scan-info">

        <div className="entry-model-scan-info-left">

          <span className="entry-model-scan-label">
            Orderbook Hunt
          </span>

          <span className="entry-model-scan-count">

            {orderbookScan}

            {" / "}

            {scansPerCycle}

          </span>

        </div>


        <div className="entry-model-scan-message">

          {combinedStateName ===
            "ORDERBOOK_HUNT"

            ? `Cycle ${orderbookCycle} / ${maxOrderbookCycles} | Confirmations ${confirmations} / ${requiredConfirmations}`

            : combinedStateName ===
              "PRICE_SIGNAL"

            ? `Price Signal ${combinedDirection}`

            : combinedStateName ===
              "ENTRY"

            ? `ENTRY READY | ${combinedDirection}`

            : combinedStateName ===
              "PYRAMID_FULL"

            ? `PYRAMID FULL | ${pyramidCount} / ${maxPyramid}`

            : combinedRunning
              ? "Waiting for Price Model signal"
              : "Combined Entry Model stopped"}

        </div>

      </div>


      {/* ====================================================
          CHART
          ==================================================== */}

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


      {/* ====================================================
          CURRENT CYCLE
          ==================================================== */}

      <div className="entry-model-table-card">

        <div className="entry-model-table-header">

          <h2 className="entry-model-table-title">
            CURRENT CYCLE
          </h2>

          <span className="entry-model-cycle-count">
            {orderbookScan} / {scansPerCycle}
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
                  Direction
                </th>

                <th>
                  Depth 5
                </th>

                <th>
                  Depth 10
                </th>

                <th>
                  Depth 15
                </th>

                <th>
                  Depth 20
                </th>

                <th>
                  Decision
                </th>

                <th>
                  Confirmed
                </th>

              </tr>

            </thead>


            <tbody>

              {currentScans.length === 0 ? (

                <tr>

                  <td
                    colSpan="9"
                    className="entry-model-empty"
                  >

                    No scans yet.

                    <br />

                    Waiting for the next
                    orderbook scan.

                    <br />
                    <br />

                    <small>
                      New scan every 20 seconds.
                    </small>

                  </td>

                </tr>

              ) : (

                currentScans.map(
                  (
                    scan,
                    index
                  ) => {

                    const scanSymbol =
                      scan?.scan?.symbol ||
                      scan?.symbol ||
                      combinedState?.symbol ||
                      selectedBot?.symbol ||
                      "-";

                    const scanDirection =
                      normalizeDirection(
                        scan?.direction ||
                        scan?.scan?.botDirection ||
                        combinedDirection ||
                        "NEUTRAL"
                      );

                    const decision =
                      normalizeDirection(
                        scan?.scan?.decision ||
                        scan?.decision ||
                        "NEUTRAL"
                      );

                    return (

                      <tr
                        key={
                          scan?.id ||
                          `${scan?.cycle || 0}-` +
                          `${scan?.scanNumber || index}`
                        }
                      >

                        {/* TIME */}

                        <td>

                          {scan?.timestamp
                            ? new Date(
                                scan.timestamp
                              ).toLocaleTimeString()
                            : "--:--:--"}

                        </td>


                        {/* COIN */}

                        <td>

                          {scanSymbol}

                        </td>


                        {/* DIRECTION */}

                        <td>

                          <span
                            className={`entry-model-decision ${scanDirection.toLowerCase()}`}
                          >

                            {scanDirection}

                          </span>

                        </td>


                        {/* DEPTH 5 */}

                        <td>

                          {renderDepthCell(
                            scan,
                            5,
                            "trend5"
                          )}

                        </td>


                        {/* DEPTH 10 */}

                        <td>

                          {renderDepthCell(
                            scan,
                            10,
                            "trend10"
                          )}

                        </td>


                        {/* DEPTH 15 */}

                        <td>

                          {renderDepthCell(
                            scan,
                            15,
                            "trend15"
                          )}

                        </td>


                        {/* DEPTH 20 */}

                        <td>

                          {renderDepthCell(
                            scan,
                            20,
                            "trend20"
                          )}

                        </td>


                        {/* DECISION */}

                        <td>

                          <span
                            className={`entry-model-decision ${decision.toLowerCase()}`}
                          >

                            {decision}

                          </span>

                        </td>


                        {/* CONFIRMED */}

                        <td>

                          <span
                            className={`entry-model-decision ${
                              scan?.confirmed
                                ? "long"
                                : "neutral"
                            }`}
                          >

                            {scan?.confirmed
                              ? "YES"
                              : "NO"}

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


      {/* ====================================================
          PREVIOUS CYCLES
          ==================================================== */}

      <div className="entry-model-table-card">

        <div className="entry-model-table-header">

          <h2 className="entry-model-table-title">
            PREVIOUS CYCLES
          </h2>

          <span className="entry-model-cycle-count">

            {previousCycles.length}
            {" completed"}

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
                  Direction
                </th>

                <th>
                  Confirmations
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

              {sortedPreviousCycles.length === 0 ? (

                <tr>

                  <td
                    colSpan="6"
                    className="entry-model-empty"
                  >

                    No completed orderbook
                    hunt cycles yet.

                  </td>

                </tr>

              ) : (

                sortedPreviousCycles.map(
                  (
                    cycle,
                    index
                  ) => (

                    <tr
                      key={
                        cycle?.id ||
                        cycle?.timestamp ||
                        cycle?.completedAt ||
                        index
                      }
                    >

                      <td>

                        {cycle?.completedAt
                          ? new Date(
                              cycle.completedAt
                            ).toLocaleTimeString()
                          : "--:--:--"}

                      </td>


                      <td>

                        {cycle?.symbol ||
                          combinedState?.symbol ||
                          selectedBot?.symbol ||
                          "-"}

                      </td>


                      <td>

                        <span
                          className={`entry-model-direction ${
                            String(
                              cycle?.direction ||
                              cycle?.botDirection ||
                              "NEUTRAL"
                            ).toLowerCase()
                          }`}
                        >

                          {cycle?.direction ||
                            cycle?.botDirection ||
                            "NEUTRAL"}

                        </span>

                      </td>


                      <td>

                        <span
                          className={`entry-model-votes ${
                            Number(
                              cycle?.confirmations ??
                              0
                            ) >=
                            Number(
                              cycle?.requiredConfirmations ??
                              5
                            )
                              ? "good"
                              : "bad"
                          }`}
                        >

                          {cycle?.confirmations ??
                            0}

                          {" / "}

                          {cycle?.requiredConfirmations ??
                            5}

                        </span>

                      </td>


                      <td>

                        {cycle?.totalScans ??
                          cycle?.scans ??
                          0}

                      </td>


                      <td>

                        <span
                          className={`entry-model-decision ${
                            String(
                              cycle?.decision ||
                              "NEUTRAL"
                            ).toLowerCase()
                          }`}
                        >

                          {cycle?.decision ||
                            "NEUTRAL"}

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
