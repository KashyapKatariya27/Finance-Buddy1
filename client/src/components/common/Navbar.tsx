import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../../store/useStore";

export const Navbar: React.FC = () => {
  const { user, currency, setCurrency, logout } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-midnight-950/85 backdrop-blur-md border-b border-midnight-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to={user ? "/dashboard" : "/"} className="flex items-center space-x-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-aurora-electric to-aurora-green flex items-center justify-center shadow-glow-sm">
            <span className="text-midnight-950 font-black text-xl">₹</span>
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-aurora-cyan to-aurora-green bg-clip-text text-transparent">
              FinanceBuddy
            </span>
            <span className="hidden sm:inline-block ml-2 text-2xs px-2 py-0.5 rounded-full bg-aurora-electric/10 text-aurora-electric font-semibold border border-aurora-electric/30">
              GOAL-FIRST
            </span>
          </div>
        </Link>

        {/* Center Navigation Links (when authenticated) */}
        {user && (
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            <Link
              to="/dashboard"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive("/dashboard")
                  ? "bg-midnight-800 text-aurora-cyan border border-aurora-cyan/30"
                  : "text-slate-300 hover:text-white hover:bg-midnight-900"
              }`}
            >
              Overview
            </Link>
            <Link
              to="/goals"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive("/goals")
                  ? "bg-midnight-800 text-aurora-cyan border border-aurora-cyan/30"
                  : "text-slate-300 hover:text-white hover:bg-midnight-900"
              }`}
            >
              Goals
            </Link>
            <Link
              to="/emergency"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive("/emergency")
                  ? "bg-midnight-800 text-aurora-cyan border border-aurora-cyan/30"
                  : "text-slate-300 hover:text-white hover:bg-midnight-900"
              }`}
            >
              Emergency Vault
            </Link>
            <Link
              to="/learning"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive("/learning")
                  ? "bg-midnight-800 text-aurora-cyan border border-aurora-cyan/30"
                  : "text-slate-300 hover:text-white hover:bg-midnight-900"
              }`}
            >
              Learning Hub
            </Link>
            <Link
              to="/transactions"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive("/transactions")
                  ? "bg-midnight-800 text-aurora-cyan border border-aurora-cyan/30"
                  : "text-slate-300 hover:text-white hover:bg-midnight-900"
              }`}
            >
              Ledger
            </Link>

            {/* Role specific: Family link only for PARENT */}
            {user.role === "PARENT" && (
              <Link
                to="/family"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/family")
                    ? "bg-midnight-800 text-aurora-cyan border border-aurora-cyan/30"
                    : "text-slate-300 hover:text-white hover:bg-midnight-900"
                }`}
              >
                Family Hub
              </Link>
            )}

            {/* Role specific: Kids portal only for CHILD */}
            {user.role === "CHILD" && (
              <Link
                to="/kids"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/kids")
                    ? "bg-midnight-800 text-aurora-cyan border border-aurora-cyan/30"
                    : "text-slate-300 hover:text-white hover:bg-midnight-900"
                }`}
              >
                Kid's Chest
              </Link>
            )}
          </nav>
        )}

        {/* Right side controls */}
        <div className="flex items-center space-x-3">
          {/* Currency Switcher */}
          <div className="inline-flex rounded-lg bg-midnight-900 p-0.5 border border-midnight-800">
            <button
              type="button"
              onClick={() => setCurrency("INR")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                currency === "INR"
                  ? "bg-aurora-electric text-midnight-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ₹ INR
            </button>
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                currency === "USD"
                  ? "bg-aurora-electric text-midnight-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              $ USD
            </button>
          </div>

          {user ? (
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-white">{user.fullName}</span>
                <span className="text-2xs font-medium text-aurora-cyan uppercase tracking-wider">
                  {user.accountMode === "MYSELF" ? "Individual" : user.accountMode === "TEEN" ? "Student" : user.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-midnight-800 hover:bg-midnight-700 rounded-lg border border-midnight-700 transition"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white transition"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="px-3.5 py-1.5 text-sm font-semibold text-midnight-950 bg-gradient-to-r from-aurora-green to-aurora-cyan hover:opacity-90 rounded-lg shadow-glow-sm transition"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
