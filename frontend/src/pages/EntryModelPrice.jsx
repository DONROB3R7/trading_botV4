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
} from "lightweight-charts";

import {
  getBots,
  getChart,
  getPriceModel,
  startPriceModel,
  stopPriceModel,
  scanPriceModel,
} from "../api";

import "./EntryModelPrice.css";

const WINDOWS = [
  10,
  15,
  20,
  30,
  60,
];

// ==========================================================
// HELPERS
// ==========================================================

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

function formatNumber(
  value,
  decimals = 4
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return number.toFixed(decimals);
}

function formatPrice(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  if (number >= 1000) {
    return number.toFixed(2);
  }

  if (number >= 1) {
    return number.toFixed(4);
  }

  return number.toFixed(6);
}

function formatTime(value) {
  if (!value) {
    return "-";
  }

  try {
    return new Date(
      value
    ).toLocaleTimeString();
  } catch {
    return String(value);
  }
}

function getWindowResult(
  scan,
  windowSize
) {
  return (
    scan?.windows?.[
      windowSize
    ] ||
    scan?.entries?.[
      windowSize
    ] ||
    scan?.entries?.[
      String(windowSize)
    ] ||
    scan?.windows?.[
      String(windowSize)
    ] ||
    null
  );
}

function getWindowDirection(
  scan,
  windowSize
) {
  const result =
    getWindowResult(
      scan,
      windowSize
    );

  return normalizeDirection(
    result?.direction ||
      "NEUTRAL"
  );
}

function getWindowValue(
  scan,
  windowSize
) {
  const result =
    getWindowResult(
      scan,
      windowSize
    );

  return (
    result?.strength ??
    result?.winningStrength ??
    result?.value ??
    null
  );
}

function getWindowMovement(
  scan,
  windowSize
) {
  const result =
    getWindowResult(
      scan,
      windowSize
    );

  return (
    result?.movement ||
    null
  );
}

function getMovementBaseline(
  scan,
  windowSize
) {
  return (
    scan?.movementBaseline
      ?.windows?.[
        windowSize
      ] ||
    scan?.movementBaseline
      ?.windows?.[
        String(windowSize)
      ] ||
    null
  );
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

function formatMovement(
  value,
  decimals = 2
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return (
    `${
      number >= 0
        ? "+"
        : ""
    }${number.toFixed(
      decimals
    )}%`
  );
}

// ==========================================================
// WINDOW CARD
// ==========================================================

function WindowCard({
  windowSize,
  result,
  baseline,
}) {
  const direction =
    normalizeDirection(
      result?.direction ||
        "NEUTRAL"
    );

  const strength =
    result?.strength ??
    result?.winningStrength ??
    null;

  const movement =
    result?.movement ||
    {};

  return (
    <div className="entry-model-card">

      <div className="entry-model-card-title">
        {windowSize} MIN
      </div>

      <div
        className={
          `entry-model-card-value ` +
          getDirectionClass(
            direction
          )
        }
      >
        {direction}
      </div>

      <div className="entry-model-card-row">
        <span>
          Strength
        </span>

        <strong>
          {formatNumber(
            strength,
            2
          )}
          %
        </strong>
      </div>

      <div className="entry-model-card-row">
        <span>
          Up
        </span>

        <strong>
          {formatNumber(
            result?.upStrength,
            2
          )}
          %
        </strong>
      </div>

      <div className="entry-model-card-row">
        <span>
          Down
        </span>

        <strong>
          {formatNumber(
            result?.downStrength,
            2
          )}
          %
        </strong>
      </div>

      <div className="entry-model-card-row">
        <span>
          Actual Move
        </span>

        <strong
          className={
            getDirectionClass(
              movement?.direction
            )
          }
        >
          {formatMovement(
            movement?.actualMove,
            2
          )}
        </strong>
      </div>

      <div className="entry-model-card-row">
        <span>
          Average
        </span>

        <strong>
          {formatMovement(
            movement?.normalMove,
            2
          )}
        </strong>
      </div>

      <div className="entry-model-card-row">
        <span>
          High
        </span>

        <strong>
          {formatMovement(
            baseline?.highMove,
            2
          )}
        </strong>
      </div>

      <div className="entry-model-card-row">
        <span>
          Extreme
        </span>

        <strong>
          {formatMovement(
            baseline?.extremeMove ??
              baseline?.maximumMove,
            2
          )}
        </strong>
      </div>

      <div className="entry-model-card-row">
        <span>
          Vs Normal
        </span>

        <strong>
          {movement?.moveVsNormal !==
            null &&
          movement?.moveVsNormal !==
            undefined
            ? `${formatNumber(
                movement.moveVsNormal,
                1
              )}%`
            : "-"}
        </strong>
      </div>

    </div>
  );
}

// ==========================================================
// MAIN COMPONENT
// ==========================================================

export default function EntryModelPrice() {
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
    chart,
    setChart,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const scanRunningRef =
    useRef(false);

  // ========================================================
  // REAL CHART REFS
  // ========================================================

  const chartContainerRef =
    useRef(null);

  const chartInstanceRef =
    useRef(null);

  const candleSeriesRef =
    useRef(null);

  const selectedBot =
    useMemo(
      () =>
        bots.find(
          (bot) =>
            bot.id ===
            selectedBotId
        ),
      [
        bots,
        selectedBotId,
      ]
    );

  const selectedSymbol =
    selectedBot?.symbol ||
    priceModel?.symbol ||
    "";

  // ========================================================
  // LOAD BOTS
  // ========================================================

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
            "[Entry Model Price] " +
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

  // ========================================================
  // LOAD PRICE MODEL
  // ========================================================

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

          if (
            data?.model
          ) {
            setPriceModel(
              data.model
            );
          }
        } catch (err) {
          console.error(
            "[Entry Model Price] " +
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

  // ========================================================
  // LOAD CHART DATA
  // ========================================================

  const loadChart =
    useCallback(
      async () => {
        if (!selectedSymbol) {
          return;
        }

        try {
          const data =
            await getChart(
              selectedSymbol,
              "1m"
            );

          setChart(
            data?.chart ||
              data ||
              null
          );
        } catch (err) {
          console.error(
            "[Entry Model Price] " +
              "Chart load error:",
            err
          );

          setChart(null);
        }
      },
      [selectedSymbol]
    );

  // ========================================================
  // CREATE / UPDATE REAL LIGHTWEIGHT CHART
  // ========================================================

  useEffect(() => {
    const container =
      chartContainerRef.current;

    if (!container) {
      return;
    }

    if (
      !chartInstanceRef.current
    ) {
      const chartInstance =
        createChart(
          container,
          {
            width:
              container.clientWidth ||
              800,

            height:
              container.clientHeight ||
              430,

            layout: {
              background: {
                color:
                  "#0d1117",
              },

              textColor:
                "#9ca3af",
            },

            grid: {
              vertLines: {
                color:
                  "#1c222c",
              },

              horzLines: {
                color:
                  "#1c222c",
              },
            },

            crosshair: {
              mode: 1,
            },

            rightPriceScale: {
              borderColor:
                "#303642",
            },

            timeScale: {
              borderColor:
                "#303642",

              timeVisible:
                true,

              secondsVisible:
                false,

              rightOffset: 5,

              barSpacing: 7,

              minBarSpacing: 2,
            },

            handleScroll: {
              mouseWheel:
                true,

              pressedMouseMove:
                true,

              horzTouchDrag:
                true,

              vertTouchDrag:
                true,
            },

            handleScale: {
              axisPressedMouseMove:
                true,

              mouseWheel:
                true,

              pinch:
                true,
            },
          }
        );

      const candleSeries =
        chartInstance.addSeries(
          CandlestickSeries,
          {
            upColor:
              "#26a69a",

            downColor:
              "#ef5350",

            borderUpColor:
              "#26a69a",

            borderDownColor:
              "#ef5350",

            wickUpColor:
              "#26a69a",

            wickDownColor:
              "#ef5350",

            priceLineVisible:
              true,

            lastValueVisible:
              true,
          }
        );

      chartInstanceRef.current =
        chartInstance;

      candleSeriesRef.current =
        candleSeries;

      const resizeObserver =
        new ResizeObserver(
          () => {
            if (
              !chartInstanceRef.current
            ) {
              return;
            }

            chartInstanceRef.current.resize(
              container.clientWidth,
              container.clientHeight
            );
          }
        );

      resizeObserver.observe(
        container
      );

      return () => {
        resizeObserver.disconnect();

        chartInstance.remove();

        chartInstanceRef.current =
          null;

        candleSeriesRef.current =
          null;
      };
    }
  }, []);

  // ========================================================
  // PUT CANDLES INTO CHART
  // ========================================================

  useEffect(() => {
    if (
      !chart ||
      !candleSeriesRef.current ||
      !chartInstanceRef.current
    ) {
      return;
    }

    const rawData =
      Array.isArray(chart)
        ? chart
        : chart?.data;

    if (
      !Array.isArray(rawData) ||
      rawData.length === 0
    ) {
      return;
    }

    const candles =
      rawData
        .map(
          (candle) => {
            const time =
              Number(
                candle?.time
              );

            const open =
              Number(
                candle?.open
              );

            const high =
              Number(
                candle?.high
              );

            const low =
              Number(
                candle?.low
              );

            const close =
              Number(
                candle?.close
              );

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

            return {
              time,
              open,
              high,
              low,
              close,
            };
          }
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            a.time -
            b.time
        );

    if (
      candles.length === 0
    ) {
      return;
    }

    const uniqueCandles = [];

    let lastTime = null;

    for (
      const candle of candles
    ) {
      if (
        candle.time ===
        lastTime
      ) {
        uniqueCandles[
          uniqueCandles.length - 1
        ] = candle;

        continue;
      }

      uniqueCandles.push(
        candle
      );

      lastTime =
        candle.time;
    }

    candleSeriesRef.current.setData(
      uniqueCandles
    );

    chartInstanceRef.current
      .timeScale()
      .fitContent();
  }, [chart]);

  // ========================================================
  // RUN PRICE SCAN
  // ========================================================

  const runPriceScan =
    useCallback(
      async () => {
        if (!selectedBotId) {
          return;
        }

        if (
          scanRunningRef.current
        ) {
          return;
        }

        scanRunningRef.current =
          true;

        try {
          const data =
            await scanPriceModel(
              selectedBotId
            );

          if (
            data?.model
          ) {
            setPriceModel(
              data.model
            );
          }

          setMessage(
            "Price scan completed"
          );

          setError("");
        } catch (err) {
          console.error(
            "[Entry Model Price] " +
              "Scan error:",
            err
          );

          setError(
            err.message ||
              "Price Model scan failed"
          );
        } finally {
          scanRunningRef.current =
            false;
        }
      },
      [selectedBotId]
    );

  // ========================================================
  // START
  // ========================================================

  const handleStart =
    useCallback(
      async () => {
        if (!selectedBotId) {
          return;
        }

        setLoading(true);
        setError("");
        setMessage("");

        try {
          const data =
            await startPriceModel(
              selectedBotId
            );

          if (
            data?.model
          ) {
            setPriceModel(
              data.model
            );
          }

          setMessage(
            "Price Model started"
          );
        } catch (err) {
          console.error(
            "[Entry Model Price] " +
              "Start error:",
            err
          );

          setError(
            err.message ||
              "Failed to start Price Model"
          );
        } finally {
          setLoading(false);
        }
      },
      [selectedBotId]
    );

  // ========================================================
  // STOP
  // ========================================================

  const handleStop =
    useCallback(
      async () => {
        if (!selectedBotId) {
          return;
        }

        setLoading(true);
        setError("");
        setMessage("");

        try {
          const data =
            await stopPriceModel(
              selectedBotId
            );

          if (
            data?.model
          ) {
            setPriceModel(
              data.model
            );
          } else {
            await loadPriceModel();
          }

          setMessage(
            "Price Model stopped"
          );
        } catch (err) {
          console.error(
            "[Entry Model Price] " +
              "Stop error:",
            err
          );

          setError(
            err.message ||
              "Failed to stop Price Model"
          );
        } finally {
          setLoading(false);
        }
      },
      [
        selectedBotId,
        loadPriceModel,
      ]
    );

  // ========================================================
  // MANUAL SCAN
  // ========================================================

  const handleManualScan =
    useCallback(
      async () => {
        setLoading(true);

        try {
          await runPriceScan();
        } finally {
          setLoading(false);
        }
      },
      [runPriceScan]
    );

  // ========================================================
  // INITIAL LOAD
  // ========================================================

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  // ========================================================
  // LOAD PRICE MODEL
  // ========================================================

  useEffect(() => {
    if (!selectedBotId) {
      return;
    }

    loadPriceModel();
  }, [
    selectedBotId,
    loadPriceModel,
  ]);

  // ========================================================
  // LOAD CHART
  // ========================================================

  useEffect(() => {
    if (!selectedSymbol) {
      return;
    }

    loadChart();
  }, [
    selectedSymbol,
    loadChart,
  ]);

  // ========================================================
  // PRICE MODEL REFRESH
  // ========================================================

  useEffect(() => {
    if (!selectedBotId) {
      return;
    }

    const timer =
      setInterval(
        () => {
          loadPriceModel();
        },
        5000
      );

    return () => {
      clearInterval(timer);
    };
  }, [
    selectedBotId,
    loadPriceModel,
  ]);

  // ========================================================
  // DATA
  // ========================================================

  const currentScans =
    priceModel?.currentScans ||
    [];

  const previousCycles =
    priceModel?.previousCycles ||
    [];

  const latestScan =
    currentScans.length > 0
      ? currentScans[
          currentScans.length - 1
        ]
      : null;

  const confirmation =
    latestScan?.confirmation ||
    {};

  const shortVotes =
    confirmation.rawShortVotes ??
    0;

  const longVotes =
    confirmation.rawLongVotes ??
    0;

  const movementBaseline =
    latestScan?.movementBaseline ||
    null;

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <div className="entry-model-page-price">

      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <div className="entry-model-header">

        <div>
          <h1>
            Entry Model Price
          </h1>

          <div className="entry-model-subtitle">
            Price-only pullback model
          </div>
        </div>

        <div className="entry-model-controls">

          <select
            value={selectedBotId}
            onChange={(event) => {
              setSelectedBotId(
                event.target.value
              );

              setChart(null);
              setPriceModel(null);
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

          <button
            type="button"
            onClick={handleStart}
            disabled={
              !selectedBotId ||
              loading
            }
          >
            START
          </button>

          <button
            type="button"
            onClick={
              handleManualScan
            }
            disabled={
              !selectedBotId ||
              loading
            }
          >
            SCAN
          </button>

          <button
            type="button"
            onClick={handleStop}
            disabled={
              !selectedBotId ||
              loading
            }
          >
            STOP
          </button>

        </div>
      </div>

      {/* ================================================== */}
      {/* MESSAGE */}
      {/* ================================================== */}

      {message && (
        <div className="entry-model-message">
          {message}
        </div>
      )}

      {error && (
        <div className="entry-model-error">
          {error}
        </div>
      )}

      {/* ================================================== */}
      {/* BOT INFO */}
      {/* ================================================== */}

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
              Direction
            </span>

            <strong
              className={
                getDirectionClass(
                  selectedBot.direction
                )
              }
            >
              {normalizeDirection(
                selectedBot.direction
              )}
            </strong>
          </div>

          <div>
            <span>
              Price Model
            </span>

            <strong
              className={
                priceModel?.running
                  ? "long"
                  : "neutral"
              }
            >
              {priceModel?.running
                ? "RUNNING"
                : "STOPPED"}
            </strong>
          </div>

          <div>
            <span>
              Current Price
            </span>

            <strong>
              {formatPrice(
                priceModel?.currentPrice
              )}
            </strong>
          </div>

          <div>
            <span>
              Trend Required
            </span>

            <strong>
              {priceModel?.config
                ?.trendRequired ??
                53}
              %
            </strong>
          </div>

        </div>
      )}

      {/* ================================================== */}
      {/* REAL CANDLE CHART */}
      {/* ================================================== */}

      <div className="entry-model-section">

        <div className="entry-model-section-header">

          <h2>
            Chart
          </h2>

          <div>
            {chart?.symbol ||
              selectedSymbol ||
              "-"}
          </div>

        </div>

        <div
          ref={chartContainerRef}
          className="entry-model-chart"
        />

        {!chart && (
          <div className="entry-model-empty">
            Chart data unavailable.
          </div>
        )}

      </div>

      {/* ================================================== */}
      {/* MOVEMENT BASELINE */}
      {/* ================================================== */}

      <div className="entry-model-section">

        <div className="entry-model-section-header">

          <h2>
            Movement Baseline
          </h2>

          <div>
            Historical NET movement
          </div>

        </div>

        <div className="entry-model-info">

          <div>
            <span>
              Candles Used
            </span>

            <strong>
              {movementBaseline
                ?.candlesUsed ??
                "-"}
            </strong>
          </div>

          <div>
            <span>
              Baseline
            </span>

            <strong
              className={
                movementBaseline
                  ?.windows
                  ? "long"
                  : "neutral"
              }
            >
              {movementBaseline
                ?.windows
                ? "READY"
                : "WAITING"}
            </strong>
          </div>

        </div>

        <div className="entry-model-table-wrapper">

          <table className="entry-model-table">

            <thead>
              <tr>

                <th>
                  Window
                </th>

                <th>
                  Samples
                </th>

                <th>
                  Average
                </th>

                <th>
                  High
                </th>

                <th>
                  Extreme
                </th>

                <th>
                  Median
                </th>

                <th>
                  Range
                </th>

              </tr>
            </thead>

            <tbody>

              {WINDOWS.map(
                (windowSize) => {

                  const baseline =
                    getMovementBaseline(
                      latestScan,
                      windowSize
                    );

                  return (
                    <tr
                      key={
                        windowSize
                      }
                    >

                      <td>
                        <strong>
                          {windowSize}m
                        </strong>
                      </td>

                      <td>
                        {baseline
                          ?.samples ??
                          "-"}
                      </td>

                      <td>
                        <strong>
                          {formatMovement(
                            baseline
                              ?.averageMove,
                            2
                          )}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {formatMovement(
                            baseline
                              ?.highMove,
                            2
                          )}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {formatMovement(
                            baseline
                              ?.extremeMove ??
                              baseline
                                ?.maximumMove,
                            2
                          )}
                        </strong>
                      </td>

                      <td>
                        {formatMovement(
                          baseline
                            ?.medianMove,
                          2
                        )}
                      </td>

                      <td>
                        {baseline
                          ? `${formatMovement(
                              baseline.minimumMove,
                              2
                            )} → ${formatMovement(
                              baseline.maximumMove,
                              2
                            )}`
                          : "-"}
                      </td>

                    </tr>
                  );
                }
              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* ================================================== */}
      {/* PULLBACK WINDOWS */}
      {/* ================================================== */}

      <div className="entry-model-section">

        <div className="entry-model-section-header">

          <h2>
            Pullback Windows
          </h2>

          <div>
            Cycle{" "}
            {priceModel?.cycleNumber ?? 0}
            {" "}
            | Scans{" "}
            {priceModel?.scanCount ?? 0}
            /
            {priceModel?.config
              ?.cycleLength ?? 10}
          </div>

        </div>

        <div className="entry-model-grid">

          {WINDOWS.map(
            (windowSize) => (
              <WindowCard
                key={windowSize}
                windowSize={
                  windowSize
                }
                result={
                  getWindowResult(
                    latestScan,
                    windowSize
                  )
                }
                baseline={
                  getMovementBaseline(
                    latestScan,
                    windowSize
                  )
                }
              />
            )
          )}

        </div>

      </div>

      {/* ================================================== */}
      {/* LATEST SCAN */}
      {/* ================================================== */}

      <div className="entry-model-section">

        <div className="entry-model-section-header">

          <h2>
            Latest Scan
          </h2>

          <div>
            {latestScan
              ? formatTime(
                  latestScan.timestamp ||
                    latestScan.time ||
                    latestScan.createdAt
                )
              : "-"}
          </div>

        </div>

        {latestScan ? (
          <div className="entry-model-latest">

            <div>
              <span>
                Candle
              </span>

              <strong>
                {latestScan.candleTime ??
                  "-"}
              </strong>
            </div>

            <div>
              <span>
                Price
              </span>

              <strong>
                {formatPrice(
                  latestScan.price
                )}
              </strong>
            </div>

            <div>
              <span>
                Trend
              </span>

              <strong
                className={
                  getDirectionClass(
                    latestScan
                      ?.trend
                      ?.direction
                  )
                }
              >
                {normalizeDirection(
                  latestScan
                    ?.trend
                    ?.direction
                )}{" "}
                {formatNumber(
                  latestScan
                    ?.trend
                    ?.strength ??
                    latestScan
                      ?.trend
                      ?.winningStrength,
                  2
                )}
                %
              </strong>
            </div>

            <div>
              <span>
                Pullback
              </span>

              <strong>
                {shortVotes} SHORT /{" "}
                {longVotes} LONG
              </strong>
            </div>

            <div>
              <span>
                Final Signal
              </span>

              <strong
                className={
                  getDirectionClass(
                    latestScan
                      ?.decision
                  )
                }
              >
                {normalizeDirection(
                  latestScan
                    ?.decision
                )}
              </strong>
            </div>

          </div>
        ) : (
          <div className="entry-model-empty">
            No scan yet.
            Press SCAN or START.
          </div>
        )}

      </div>

      {/* ================================================== */}
      {/* CURRENT CYCLE */}
      {/* ================================================== */}

      <div className="entry-model-section">

        <div className="entry-model-section-header">

          <h2>
            Current Cycle
          </h2>

          <div>
            {currentScans.length} scans
          </div>

        </div>

        <div className="entry-model-table-wrapper">

          <table className="entry-model-table">

            <thead>
              <tr>

                <th>
                  #
                </th>

                <th>
                  Time
                </th>

                <th>
                  Price
                </th>

                <th>
                  Trend
                </th>

                {WINDOWS.map(
                  (windowSize) => (
                    <th
                      key={
                        windowSize
                      }
                    >
                      {windowSize}m
                    </th>
                  )
                )}

                <th>
                  Signal
                </th>

              </tr>
            </thead>

            <tbody>

              {currentScans.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={
                      5 +
                      WINDOWS.length
                    }
                  >
                    No scans yet.
                  </td>
                </tr>
              ) : (
                currentScans
                  .slice()
                  .reverse()
                  .map(
                    (
                      row,
                      index
                    ) => (
                      <tr
                        key={
                          row.candleTime ||
                          row.timestamp ||
                          index
                        }
                      >

                        <td>
                          {currentScans.length -
                            index}
                        </td>

                        <td>
                          {formatTime(
                            row.timestamp
                          )}
                        </td>

                        <td>
                          {formatPrice(
                            row.price
                          )}
                        </td>

                        <td
                          className={
                            getDirectionClass(
                              row
                                ?.trend
                                ?.direction
                            )
                          }
                        >
                          <strong>
                            {normalizeDirection(
                              row
                                ?.trend
                                ?.direction
                            )}
                          </strong>

                          <small>
                            {" "}
                            {formatNumber(
                              row
                                ?.trend
                                ?.strength ??
                                row
                                  ?.trend
                                  ?.winningStrength,
                              2
                            )}
                            %
                          </small>
                        </td>

                        {WINDOWS.map(
                          (
                            windowSize
                          ) => {
                            const result =
                              getWindowResult(
                                row,
                                windowSize
                              );

                            const direction =
                              getWindowDirection(
                                row,
                                windowSize
                              );

                            const value =
                              getWindowValue(
                                row,
                                windowSize
                              );

                            const movement =
                              getWindowMovement(
                                row,
                                windowSize
                              );

                            const baseline =
                              getMovementBaseline(
                                row,
                                windowSize
                              );

                            return (
                              <td
                                key={
                                  windowSize
                                }
                                className={
                                  getDirectionClass(
                                    direction
                                  )
                                }
                              >

                                <strong>
                                  {
                                    direction
                                  }
                                </strong>

                                <small>
                                  {" "}
                                  {formatNumber(
                                    value,
                                    2
                                  )}
                                  %
                                </small>

                                <div
                                  style={{
                                    marginTop:
                                      "5px",
                                    fontSize:
                                      "10px",
                                    lineHeight:
                                      "1.5",
                                    color:
                                      "#9ca3af",
                                  }}
                                >

                                  <div>
                                    Actual:{" "}
                                    <span
                                      className={
                                        getDirectionClass(
                                          movement
                                            ?.direction
                                        )
                                      }
                                    >
                                      {formatMovement(
                                        movement
                                          ?.actualMove,
                                        2
                                      )}
                                    </span>
                                  </div>

                                  <div>
                                    Average:{" "}
                                    {formatMovement(
                                      baseline
                                        ?.averageMove,
                                      2
                                    )}
                                  </div>

                                  <div>
                                    High:{" "}
                                    {formatMovement(
                                      baseline
                                        ?.highMove,
                                      2
                                    )}
                                  </div>

                                  <div>
                                    Extreme:{" "}
                                    {formatMovement(
                                      baseline
                                        ?.extremeMove ??
                                        baseline
                                          ?.maximumMove,
                                      2
                                    )}
                                  </div>

                                  <div>
                                    Vs average:{" "}
                                    <strong>
                                      {movement
                                        ?.moveVsNormal !==
                                        null &&
                                      movement
                                        ?.moveVsNormal !==
                                        undefined
                                        ? `${formatNumber(
                                            movement.moveVsNormal,
                                            1
                                          )}%`
                                        : "-"}
                                    </strong>
                                  </div>

                                </div>

                              </td>
                            );
                          }
                        )}

                        <td
                          className={
                            getDirectionClass(
                              row?.decision
                            )
                          }
                        >
                          <strong>
                            {normalizeDirection(
                              row?.decision
                            )}
                          </strong>
                        </td>

                      </tr>
                    )
                  )
              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* ================================================== */}
      {/* PREVIOUS CYCLES */}
      {/* ================================================== */}

      <div className="entry-model-section">

        <div className="entry-model-section-header">

          <h2>
            Previous Cycles
          </h2>

          <div>
            {previousCycles.length} cycles
          </div>

        </div>

        {previousCycles.length ===
        0 ? (
          <div className="entry-model-empty">
            No completed cycles yet.
          </div>
        ) : (
          <div className="entry-model-table-wrapper">

            <table className="entry-model-table">

              <thead>
                <tr>

                  <th>
                    Cycle
                  </th>

                  <th>
                    Scans
                  </th>

                  <th>
                    Start
                  </th>

                  <th>
                    End
                  </th>

                  <th>
                    Votes
                  </th>

                  <th>
                    Decision
                  </th>

                  <th>
                    Reason
                  </th>

                </tr>
              </thead>

              <tbody>

                {previousCycles
                  .slice()
                  .reverse()
                  .map(
                    (
                      cycle,
                      index
                    ) => {

                      const votes =
                        cycle?.votes ||
                        {};

                      return (
                        <tr
                          key={
                            cycle.cycleId ||
                            cycle.id ||
                            index
                          }
                        >

                          <td>
                            {cycle.cycleId ??
                              index + 1}
                          </td>

                          <td>
                            {cycle
                              ?.candles
                              ?.length ??
                              cycle
                                ?.scans
                                ?.length ??
                              0}
                          </td>

                          <td>
                            {formatTime(
                              cycle.startTime
                            )}
                          </td>

                          <td>
                            {formatTime(
                              cycle.endTime
                            )}
                          </td>

                          <td>
                            {votes.long ??
                              0}
                            L /{" "}
                            {votes.short ??
                              0}
                            S /{" "}
                            {votes.neutral ??
                              0}
                            N
                          </td>

                          <td
                            className={
                              getDirectionClass(
                                cycle.decision
                              )
                            }
                          >
                            <strong>
                              {normalizeDirection(
                                cycle.decision
                              )}
                            </strong>
                          </td>

                          <td>
                            {cycle.reason ||
                              "-"}
                          </td>

                        </tr>
                      );
                    }
                  )}

              </tbody>

            </table>

          </div>
        )}

      </div>

    </div>
  );
}
