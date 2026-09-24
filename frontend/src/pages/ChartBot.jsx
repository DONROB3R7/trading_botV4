import {
  useEffect,
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
  const chartContainerRef =
    useRef(null);

  const chartRef =
    useRef(null);

  const candleSeriesRef =
    useRef(null);

  const selectedBotRef =
    useRef(null);

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

  const selectedBot =
    bots.find(
      (bot) =>
        bot.id ===
        selectedBotId
    ) || null;

  selectedBotRef.current =
    selectedBot;

  // ============================================================
  // LOAD BOTS
  // ============================================================

  async function loadBots() {
    try {
      setLoadingBots(true);

      const result =
        await getBots();

      const loadedBots =
        Array.isArray(
          result.data
        )
          ? result.data
          : [];

      setBots(
        loadedBots
      );

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
      // If selected bot was deleted, select first remaining bot.
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
    } catch (err) {
      console.error(
        "[Chart Bot] Bot load error:",
        err
      );

      setError(
        err.message
      );
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
      !bot.symbol ||
      !candleSeriesRef.current
    ) {
      return;
    }

    try {
      setChartLoading(true);
      setError("");

      const result =
        await getChart(
          bot.symbol
        );

      if (
        !Array.isArray(
          result.data
        )
      ) {
        throw new Error(
          "Invalid chart data"
        );
      }

      if (
        selectedBotRef.current?.id !==
        bot.id
      ) {
        return;
      }

      candleSeriesRef.current.setData(
        result.data
      );

      if (
        !keepZoom &&
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
        selectedBotRef.current?.id ===
        bot.id
      ) {
        setError(
          err.message
        );
      }
    } finally {
      setChartLoading(false);
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

    chartRef.current =
      chart;

    candleSeriesRef.current =
      candleSeries;

    const handleResize =
      () => {
        if (
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

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );

      chart.remove();

      chartRef.current =
        null;

      candleSeriesRef.current =
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
      return;
    }

    if (
      candleSeriesRef.current
    ) {
      candleSeriesRef.current.setData(
        []
      );
    }

    loadBotChart(
      selectedBot,
      false
    );
  }, [
    selectedBotId,
  ]);

  // ============================================================
  // AUTO REFRESH
  // ============================================================

  useEffect(() => {
    const timer =
      setInterval(() => {
        const bot =
          selectedBotRef.current;

        if (bot) {
          loadBotChart(
            bot,
            true
          );
        }
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
    if (!selectedBot) {
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
        err.message
      );
    } finally {
      setActionLoading(false);
    }
  }

  // ============================================================
  // CLOSE POSITION
  // ============================================================

  async function handleClosePosition() {
    if (!selectedBot) {
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
        err.message
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

              <tr>
                <td>
                  Bot Name
                </td>

                <td>
                  {selectedBot.name}
                </td>
              </tr>

              <tr>
                <td>
                  Direction
                </td>

                <td>
                  {selectedBot.direction}
                </td>
              </tr>

              <tr>
                <td>
                  Entry Method
                </td>

                <td>
                  Button Press
                </td>
              </tr>

              <tr>
                <td>
                  Stop Loss
                </td>

                <td>
                  {selectedBot.stopLoss}%
                </td>
              </tr>

              <tr>
                <td>
                  Take Profit
                </td>

                <td>
                  {selectedBot.takeProfit}%
                </td>
              </tr>

              {/* ==================================================
                  ENTER
                  ================================================== */}

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
                      actionLoading ||
                      selectedBot.status !==
                        "ACTIVE"
                    }
                  >
                    {actionLoading
                      ? "WORKING..."
                      : `ENTER ${selectedBot.direction}`}
                  </button>

                </td>
              </tr>

              {/* ==================================================
                  CLOSE
                  ================================================== */}

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