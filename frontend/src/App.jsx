import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Navbar from "./components/Navbar";

import Dashboard from "./pages/Dashboard";
import TradeTest from "./pages/TradeTest";
import ChartBot from "./pages/ChartBot";
import BotManagement from "./pages/BotManagement";

// ============================================================
// APP
// ============================================================

function App() {
  return (
    <BrowserRouter>

      <div className="app-shell">

        <Navbar />

        <main className="app-content">

          <Routes>

            <Route
              path="/"
              element={
                <Navigate
                  to="/dashboard"
                  replace
                />
              }
            />

            <Route
              path="/dashboard"
              element={
                <Dashboard />
              }
            />

            <Route
              path="/trade-test"
              element={
                <TradeTest />
              }
            />

            <Route
              path="/chart-bot"
              element={
                <ChartBot />
              }
            />

            <Route
              path="/bot-management"
              element={
                <BotManagement />
              }
            />

          </Routes>

        </main>

      </div>

    </BrowserRouter>
  );
}

export default App;