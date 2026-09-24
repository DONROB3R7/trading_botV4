import {
  NavLink,
} from "react-router-dom";

import "./Navbar.css";

// ============================================================
// NAVBAR
// ============================================================

function Navbar() {
  return (
    <header className="navbar">

      <div className="navbar-inner">

        <div className="brand">

          <div className="brand-icon">
            🦴
          </div>

          <div>

            <div className="brand-title">
              WEEX BOT V4
            </div>

            <div className="brand-subtitle">
              Caveman Trading Lab
            </div>

          </div>

        </div>

        <nav className="nav-links">

          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `nav-link ${
                isActive
                  ? "active"
                  : ""
              }`
            }
          >
            <span>🏠</span>
            Dashboard
          </NavLink>

          <NavLink
            to="/bot-management"
            className={({ isActive }) =>
              `nav-link ${
                isActive
                  ? "active"
                  : ""
              }`
            }
          >
            <span>🤖</span>
            Bot Management
          </NavLink>

                    <NavLink
            to="/chart-bot"
            className={({ isActive }) =>
              `nav-link ${
                isActive
                  ? "active"
                  : ""
              }`
            }
          >
            <span>📈</span>
            Chart Bot
          </NavLink>

          <NavLink
            to="/trade-test"
            className={({ isActive }) =>
              `nav-link ${
                isActive
                  ? "active"
                  : ""
              }`
            }
          >
            <span>🧪</span>
            Trade Test
          </NavLink>




        </nav>

      </div>

    </header>
  );
}

export default Navbar;