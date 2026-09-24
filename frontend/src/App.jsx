import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Navbar from "./components/Navbar";

import Dashboard from "./pages/Dashboard";
import TradeTest from "./pages/TradeTest";

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

          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;