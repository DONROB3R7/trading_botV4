import {
  useEffect,
  useState,
} from "react";

import {
  getAccount,
  getHealth,
  getPositions,
} from "../api";

import "./Dashboard.css";

// ============================================================
// DASHBOARD
// ============================================================

function Dashboard() {
  const [
    health,
    setHealth,
  ] = useState(null);

  const [
    account,
    setAccount,
  ] = useState(null);

  const [
    positions,
    setPositions,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  async function loadDashboard() {
    try {
      setError("");

      const [
        healthResult,
        accountResult,
        positionResult,
      ] = await Promise.all([
        getHealth(),
        getAccount(),
        getPositions(),
      ]);

      setHealth(
        healthResult
      );

      setAccount(
        accountResult
      );

      setPositions(
        positionResult.data ||
        []
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
    loadDashboard();
  }, []);

  return (
    <div className="dashboard-page">

      <div className="page-heading">
        <div>
          <div className="eyebrow">
            🦴 CAVEMAN COMMAND CENTER
          </div>

          <h1>
            Dashboard
          </h1>

          <p>
            Small steps. Real exchange.
            No magic smoke.
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={
            loadDashboard
          }
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="error-box">
          🪨 {error}
        </div>
      )}

      <div className="dashboard-grid">

        <section className="status-card">

          <div className="card-icon">
            🟢
          </div>

          <div>
            <div className="card-label">
              BACKEND
            </div>

            <div className="card-value">
              {loading
                ? "..."
                : health?.status ||
                  "UNKNOWN"}
            </div>
          </div>

        </section>

        <section className="status-card">

          <div className="card-icon">
            💰
          </div>

          <div>
            <div className="card-label">
              AVAILABLE USDT
            </div>

            <div className="card-value">
              {loading
                ? "..."
                : account?.data?.[0]
                    ?.availableBalance ||
                  "0"}
            </div>
          </div>

        </section>

        <section className="status-card">

          <div className="card-icon">
            📦
          </div>

          <div>
            <div className="card-label">
              OPEN POSITIONS
            </div>

            <div className="card-value">
              {positions.length}
            </div>
          </div>

        </section>

      </div>

      <section className="welcome-card">

        <div className="welcome-icon">
          🧪
        </div>

        <div>

          <h2>
            Test room is ready.
          </h2>

          <p>
            Go to{" "}
            <strong>
              Trade Test
            </strong>{" "}
            when you're ready to test
            the tiny POLUSDT market order.
          </p>

        </div>

      </section>

    </div>
  );
}

export default Dashboard;