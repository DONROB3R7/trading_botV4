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
} from "../api";

import "./EntryModel.css";

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
SERVER ENTRY MODEL STATE
========================================================== */

const [
engineState,
setEngineState,
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


/*

* IMPORTANT
*
* React does NOT calculate bot direction.
*
* Backend owns it.
  */

const botDirection =
selectedBot?.direction || "";

/*

* IMPORTANT
*
* React does NOT calculate trigger state.
*
* Backend owns it.
  */

const triggerState =
selectedBot?.triggerState || "";

const isArmed =
triggerState === "ARMED";

/*

* IMPORTANT
*
* React does NOT control bot status.
*
* Backend owns it.
  */

const botStatus =
selectedBot?.status || "";

/* ==========================================================
SERVER ENGINE DATA
========================================================== */

const currentScans =
Array.isArray(
engineState?.currentScans
)
? engineState.currentScans
: [];

const previousCycles =
Array.isArray(
engineState?.previousCycles
)
? engineState.previousCycles
: [];

const scanCount =
Number(
engineState?.scanCount || 0
);

const cycleNumber =
Number(
engineState?.cycleNumber || 0
);

const running =
Boolean(
engineState?.running
);

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


      setBots(
        list
      );


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

        setSelectedBotId(
          ""
        );

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


      /*
       * Chart conversion only.
       *
       * NO Entry Model calculations.
       */

      const normalized =
        rawData
          .map(
            (candle) => {

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
                !Number.isFinite(
                  time
                ) ||
                !Number.isFinite(
                  open
                ) ||
                !Number.isFinite(
                  high
                ) ||
                !Number.isFinite(
                  low
                ) ||
                !Number.isFinite(
                  close
                )
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
          )
          .filter(
            Boolean
          )
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
          (candle) => {

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
              !Number.isFinite(
                time
              ) ||
              !Number.isFinite(
                open
              ) ||
              !Number.isFinite(
                high
              ) ||
              !Number.isFinite(
                low
              ) ||
              !Number.isFinite(
                close
              )
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
        )
        .filter(
          Boolean
        )
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
FINAL SIGNAL MARKERS


 SERVER ONLY.
 
 React does NOT calculate signals.
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
  const cycle of previousCycles
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


  const rawTime =
    cycle?.timestamp;


  if (
    rawTime === null ||
    rawTime === undefined
  ) {

    continue;

  }


  const cycleTime =
    typeof rawTime === "number"
      ? rawTime > 100000000000
        ? Math.floor(
            rawTime / 1000
          )
        : Math.floor(
            rawTime
          )
      : Math.floor(
          Date.parse(
            rawTime
          ) / 1000
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
SERVER ENTRY MODEL ENGINE


 DISPLAY ONLY.
 
 React DOES NOT:
   - start engine
   - stop engine
   - resume engine
   - update engine
   - calculate direction
   - calculate scans
   - calculate votes
   - calculate cycles
 
 BACKEND IS THE ONLY ENGINE OWNER.
 ========================================================== */


useEffect(() => {


if (!selectedBot) {

  setEngineState(
    null
  );

  return;

}


let cancelled =
  false;


async function loadEngineState() {

  try {

    const status =
      await getEntryModelEngine(
        selectedBot.id
      );


    if (
      cancelled
    ) {

      return;

    }


    /*
     * SERVER IS THE SOURCE OF TRUTH.
     *
     * Store exactly what backend returns.
     */

    setEngineState(
      status
    );


    console.log(
      "[Entry Model] SERVER STATE:",
      status
    );

  } catch (err) {

    if (
      cancelled
    ) {

      return;

    }


    console.error(
      "[Entry Model] Engine status error:",
      err
    );

    setError(
      err?.message ||
      "Failed to load Entry Model engine."
    );

  }

}


/*
 * Initial server state.
 */

loadEngineState();


/*
 * React only watches the backend.
 *
 * 3 second display refresh.
 */

const timer =
  setInterval(
    loadEngineState,
    3000
  );


return () => {

  cancelled =
    true;

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
   * Display only.
   *
   * This does NOT reset backend state.
   */

  setEngineState(
    null
  );

  setError("");

  setSuccess("");

};


/* ==========================================================
RENDER
========================================================== */

return ( <div className="entry-model-page">


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

              {bot.direction}

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

        {selectedBot?.direction ||
          "NONE"}

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
        Engine:
      </span>


      <span className="entry-model-status-value">

        {running
          ? "RUNNING"
          : "STOPPED"}

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

        {scanCount} / 3

      </span>

    </div>


    <div className="entry-model-scan-message">

      {running
        ? "Orderbook scan running every 1 minute"
        : isArmed
          ? "Entry Model engine stopped"
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

        {scanCount} / 3

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
              ) => (

                <tr
                  key={
                    scan?.id ||
                    scan?.timestamp ||
                    index
                  }
                >

                  <td>

                    {scan?.timestamp
                      ? new Date(
                          scan.timestamp
                        ).toLocaleTimeString()
                      : "--:--:--"}

                  </td>


                  <td>

                    {scan?.symbol ||
                      selectedBot?.symbol ||
                      "-"}

                  </td>


                  {/* TREND 15 */}

                  <td>

                    <span
                      className={`entry-model-direction ${
                        String(
                          scan?.trend15 ||
                          "NEUTRAL"
                        ).toLowerCase()
                      }`}
                    >

                      {scan?.trend15 ||
                        "NEUTRAL"}

                    </span>


                    {scan?.percentage15 !== null &&
                      scan?.percentage15 !== undefined && (

                        <small
                          style={{
                            marginLeft: "5px",
                            opacity: 0.7,
                            fontSize: "11px",
                          }}
                        >

                          {scan.percentage15}%

                        </small>

                      )}

                  </td>


                  {/* TREND 20 */}

                  <td>

                    <span
                      className={`entry-model-direction ${
                        String(
                          scan?.trend20 ||
                          "NEUTRAL"
                        ).toLowerCase()
                      }`}
                    >

                      {scan?.trend20 ||
                        "NEUTRAL"}

                    </span>


                    {scan?.percentage20 !== null &&
                      scan?.percentage20 !== undefined && (

                        <small
                          style={{
                            marginLeft: "5px",
                            opacity: 0.7,
                            fontSize: "11px",
                          }}
                        >

                          {scan.percentage20}%

                        </small>

                      )}

                  </td>


                  {/* TREND 30 */}

                  <td>

                    <span
                      className={`entry-model-direction ${
                        String(
                          scan?.trend30 ||
                          "NEUTRAL"
                        ).toLowerCase()
                      }`}
                    >

                      {scan?.trend30 ||
                        "NEUTRAL"}

                    </span>


                    {scan?.percentage30 !== null &&
                      scan?.percentage30 !== undefined && (

                        <small
                          style={{
                            marginLeft: "5px",
                            opacity: 0.7,
                            fontSize: "11px",
                          }}
                        >

                          {scan.percentage30}%

                        </small>

                      )}

                  </td>


                  {/* TREND 60 */}

                  <td>

                    <span
                      className={`entry-model-direction ${
                        String(
                          scan?.trend60 ||
                          "NEUTRAL"
                        ).toLowerCase()
                      }`}
                    >

                      {scan?.trend60 ||
                        "NEUTRAL"}

                    </span>


                    {scan?.percentage60 !== null &&
                      scan?.percentage60 !== undefined && (

                        <small
                          style={{
                            marginLeft: "5px",
                            opacity: 0.7,
                            fontSize: "11px",
                          }}
                        >

                          {scan.percentage60}%

                        </small>

                      )}

                  </td>


                  {/* DECISION */}

                  <td>

                    <span
                      className={`entry-model-decision ${
                        String(
                          scan?.decision ||
                          "NEUTRAL"
                        ).toLowerCase()
                      }`}
                    >

                      {scan?.decision ||
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
                here after 3 scans.

              </td>

            </tr>

          ) : (

            previousCycles.map(
              (
                cycle,
                index
              ) => (

                <tr
                  key={
                    cycle?.id ||
                    cycle?.timestamp ||
                    index
                  }
                >

                  <td>

                    {cycle?.timestamp
                      ? new Date(
                          cycle.timestamp
                        ).toLocaleTimeString()
                      : "--:--:--"}

                  </td>


                  <td>

                    {cycle?.symbol ||
                      "-"}

                  </td>


                  <td>

                    <span
                      className={`entry-model-direction ${
                        String(
                          cycle?.botDirection ||
                          "NEUTRAL"
                        ).toLowerCase()
                      }`}
                    >

                      {cycle?.botDirection ||
                        "NEUTRAL"}

                    </span>

                  </td>


                  <td>

                    <span
                      className={`entry-model-direction ${
                        String(
                          cycle?.trend15 ||
                          "NEUTRAL"
                        ).toLowerCase()
                      }`}
                    >

                      {cycle?.trend15 ||
                        "NEUTRAL"}

                    </span>

                  </td>


                  <td>

                    <span
                      className={`entry-model-direction ${
                        String(
                          cycle?.trend20 ||
                          "NEUTRAL"
                        ).toLowerCase()
                      }`}
                    >

                      {cycle?.trend20 ||
                        "NEUTRAL"}

                    </span>

                  </td>


                  <td>

                    <span
                      className={`entry-model-direction ${
                        String(
                          cycle?.trend30 ||
                          "NEUTRAL"
                        ).toLowerCase()
                      }`}
                    >

                      {cycle?.trend30 ||
                        "NEUTRAL"}

                    </span>

                  </td>


                  <td>

                    <span
                      className={`entry-model-direction ${
                        String(
                          cycle?.trend60 ||
                          "NEUTRAL"
                        ).toLowerCase()
                      }`}
                    >

                      {cycle?.trend60 ||
                        "NEUTRAL"}

                    </span>

                  </td>


                  <td>

                    <span
                      className={`entry-model-votes ${
                        Number(
                          cycle?.votes || 0
                        ) >= 6
                          ? "good"
                          : "bad"
                      }`}
                    >

                      {cycle?.votes ?? 0}

                      {" / 10"}

                    </span>

                  </td>


                  <td>

                    {cycle?.totalScans ??
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
