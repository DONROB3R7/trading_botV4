import {
  useEffect,
  useState,
} from "react";

import {
  getPositions,
  openPolusdtLong,
  openPolusdtShort,
  closePolusdt,
  updatePolusdtTpSl,
} from "../api";

import "./TradeTest.css";

function TradeTest() {
  const [positions, setPositions] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [orderLoading, setOrderLoading] =
    useState("");

  const [tpslLoading, setTpslLoading] =
    useState(false);

  const [closeLoading, setCloseLoading] =
    useState(false);

  const [slPercent, setSlPercent] =
    useState("3");

  const [tpPercent, setTpPercent] =
    useState("5");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  // ==========================================================
  // LOAD POSITIONS
  // ==========================================================

  async function loadData() {
    try {
      setError("");

      const result =
        await getPositions();

      setPositions(
        result.data || []
      );
    } catch (err) {
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

  // ==========================================================
  // CHECK POLUSDT POSITION
  // ==========================================================

  const polusdtPosition =
    positions.find(
      (position) =>
        position.symbol ===
          "POLUSDT" &&
        Number(
          position.size || 0
        ) !== 0
    );

  const hasPosition =
    Boolean(
      polusdtPosition
    );

  // ==========================================================
  // OPEN LONG
  // ==========================================================

  async function handleLong() {
    if (
      orderLoading ||
      tpslLoading ||
      closeLoading
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Open REAL POLUSDT LONG?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      setOrderLoading("LONG");

      const result =
        await openPolusdtLong();

      if (result.success) {
        setMessage(
          "🟢 POLUSDT LONG opened successfully."
        );
      } else {
        setError(
          result.error ||
          "LONG failed."
        );
      }

      await loadData();
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setOrderLoading("");
    }
  }

  // ==========================================================
  // OPEN SHORT
  // ==========================================================

  async function handleShort() {
    if (
      orderLoading ||
      tpslLoading ||
      closeLoading
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Open REAL POLUSDT SHORT?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      setOrderLoading("SHORT");

      const result =
        await openPolusdtShort();

      if (result.success) {
        setMessage(
          "🔴 POLUSDT SHORT opened successfully."
        );
      } else {
        setError(
          result.error ||
          "SHORT failed."
        );
      }

      await loadData();
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setOrderLoading("");
    }
  }

  // ==========================================================
  // CLOSE POSITION
  // ==========================================================

  async function handleClose() {
    if (
      closeLoading ||
      orderLoading ||
      tpslLoading
    ) {
      return;
    }

    if (!hasPosition) {
      setError(
        "No open POLUSDT position."
      );
      return;
    }

    const confirmed =
      window.confirm(
        "CLOSE the REAL POLUSDT position?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      setCloseLoading(true);

      const result =
        await closePolusdt();

      if (result.success) {
        setMessage(
          "⚪ POLUSDT position closed successfully."
        );
      } else {
        setError(
          result.error ||
          "CLOSE failed."
        );
      }

      await loadData();
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setCloseLoading(false);
    }
  }

  // ==========================================================
  // UPDATE TP / SL
  // ==========================================================

  async function handleUpdateTpSl() {
    if (
      tpslLoading ||
      orderLoading ||
      closeLoading
    ) {
      return;
    }

    if (!hasPosition) {
      setError(
        "No open POLUSDT position."
      );
      return;
    }

    const sl =
      Number(slPercent);

    const tp =
      Number(tpPercent);

    if (
      !Number.isFinite(sl) ||
      sl <= 0
    ) {
      setError(
        "SL must be greater than 0%."
      );
      return;
    }

    if (
      !Number.isFinite(tp) ||
      tp <= 0
    ) {
      setError(
        "TP must be greater than 0%."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Set SL ${sl}% and TP ${tp}% on the current POLUSDT position?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      setTpslLoading(true);

      const result =
        await updatePolusdtTpSl(
          sl,
          tp
        );

      if (result.success) {
        setMessage(
          `🛡️ TP/SL updated. SL=${result.stopLoss} | TP=${result.takeProfit}`
        );
      } else {
        setError(
          result.error ||
          "TP/SL update failed."
        );
      }
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setTpslLoading(false);
    }
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="trade-test-page">

      <div className="page-heading">
        <div>
          <div className="eyebrow">
            🧪 LIVE TEST LAB
          </div>

          <h1>
            POLUSDT Test
          </h1>

          <p>
            Simple market-order test. Nothing else.
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={loadData}
          disabled={
            Boolean(orderLoading) ||
            tpslLoading ||
            closeLoading
          }
        >
          🔄 Refresh
        </button>
      </div>

      {message && (
        <div className="success-box">
          {message}
        </div>
      )}

      {error && (
        <div className="error-box">
          🪨 {error}
        </div>
      )}

      <section className="warning-card">

        <div className="warning-icon">
          ⚠️
        </div>

        <div>
          <strong>
            REAL MONEY TEST
          </strong>

          <p>
            LONG = BUY 10 contracts.
            SHORT = SELL 10 contracts.
            CLOSE = closes the current POLUSDT position.
          </p>
        </div>

      </section>

      <section className="test-grid">

        <div className="info-panel">

          <div className="panel-title">
            🧮 TEST SETTINGS
          </div>

          <div className="metrics">

            <div className="metric">
              <span>
                Symbol
              </span>
              <strong>
                POLUSDT
              </strong>
            </div>

            <div className="metric">
              <span>
                Contracts
              </span>
              <strong>
                10
              </strong>
            </div>

            <div className="metric">
              <span>
                Leverage
              </span>
              <strong>
                10x
              </strong>
            </div>

            <div className="metric">
              <span>
                Margin
              </span>
              <strong>
                ISOLATED
              </strong>
            </div>

            <div className="metric">
              <span>
                Order type
              </span>
              <strong>
                MARKET
              </strong>
            </div>

            <div className="metric">
              <span>
                Price
              </span>
              <strong>
                WEEX MARKET
              </strong>
            </div>

          </div>

        </div>

        <div className="trade-panel">

          <div className="panel-title">
            🪨 CAVEMAN ORDERS
          </div>

          <div className="position-status">

            <span>
              Current POLUSDT:
            </span>

            <strong
              className={
                hasPosition
                  ? "position-open"
                  : "position-flat"
              }
            >
              {loading
                ? "CHECKING..."
                : hasPosition
                  ? "POSITION OPEN"
                  : "FLAT"}
            </strong>

          </div>

          <div className="trade-buttons">

            <button
              className="trade-button long"
              onClick={handleLong}
              disabled={
                Boolean(orderLoading) ||
                hasPosition ||
                tpslLoading ||
                closeLoading
              }
            >
              <span className="trade-icon">
                🟢
              </span>

              <span>
                {orderLoading === "LONG"
                  ? "OPENING..."
                  : "OPEN LONG"}
              </span>
            </button>

            <button
              className="trade-button short"
              onClick={handleShort}
              disabled={
                Boolean(orderLoading) ||
                hasPosition ||
                tpslLoading ||
                closeLoading
              }
            >
              <span className="trade-icon">
                🔴
              </span>

              <span>
                {orderLoading === "SHORT"
                  ? "OPENING..."
                  : "OPEN SHORT"}
              </span>
            </button>

          </div>

          <div
            className="tpsl-inputs"
          >

            <label>
              Stop Loss %

              <input
                type="number"
                min="0.01"
                step="0.1"
                value={slPercent}
                onChange={
                  (event) =>
                    setSlPercent(
                      event.target.value
                    )
                }
                disabled={
                  !hasPosition ||
                  tpslLoading ||
                  closeLoading
                }
              />
            </label>

            <label>
              Take Profit %

              <input
                type="number"
                min="0.01"
                step="0.1"
                value={tpPercent}
                onChange={
                  (event) =>
                    setTpPercent(
                      event.target.value
                    )
                }
                disabled={
                  !hasPosition ||
                  tpslLoading ||
                  closeLoading
                }
              />
            </label>

          </div>

          <button
            className="refresh-button"
            onClick={
              handleUpdateTpSl
            }
            disabled={
              !hasPosition ||
              tpslLoading ||
              closeLoading ||
              Boolean(orderLoading)
            }
          >
            {tpslLoading
              ? "UPDATING..."
              : "🛡️ UPDATE TP / SL"}
          </button>

          <button
            className="refresh-button"
            onClick={
              handleClose
            }
            disabled={
              !hasPosition ||
              closeLoading ||
              tpslLoading ||
              Boolean(orderLoading)
            }
            style={{
              width: "100%",
              marginTop: "12px",
            }}
          >
            {closeLoading
              ? "CLOSING..."
              : "⚪ CLOSE POSITION"}
          </button>

          {hasPosition && (
            <div className="position-note">
              🪨 Position exists. CLOSE sends a reduce-only market order.
            </div>
          )}

        </div>

      </section>

    </div>
  );
}

export default TradeTest;