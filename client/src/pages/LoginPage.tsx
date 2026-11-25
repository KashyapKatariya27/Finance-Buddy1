import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api";
import { useStore } from "../store/useStore";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const performLogin = async (loginEmail: string, loginPass: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, password: loginPass })
      });

      setUser(data.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(email, password);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-midnight-900/80 p-8 rounded-3xl border border-midnight-800 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-aurora-electric to-aurora-green mx-auto flex items-center justify-center shadow-glow-sm">
            <span className="text-midnight-950 font-black text-2xl">🔐</span>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold text-white">Welcome Back</h1>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to track and unlock your financial goals
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-aurora-pink/10 border border-aurora-pink/30 text-aurora-pink text-sm">
            {error}
          </div>
        )}

        {/* Quick Demo Logins */}
        <div className="space-y-2">
          <p className="text-xs uppercase font-bold tracking-wider text-slate-400 text-center">
            ⚡ Quick Demo Accounts
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => performLogin("riya@demo.com", "password123")}
              className="p-2.5 rounded-xl bg-midnight-950 hover:bg-midnight-800 border border-midnight-800 hover:border-aurora-electric text-left transition"
            >
              <div className="text-xs font-bold text-white flex items-center justify-between">
                <span>Riya Sharma</span>
                <span className="text-2xs text-aurora-electric">₹ INR</span>
              </div>
              <div className="text-2xs text-slate-400">Individual (Myself, Age 26)</div>
            </button>

            <button
              type="button"
              onClick={() => performLogin("aman@demo.com", "password123")}
              className="p-2.5 rounded-xl bg-midnight-950 hover:bg-midnight-800 border border-midnight-800 hover:border-aurora-cyan text-left transition"
            >
              <div className="text-xs font-bold text-white flex items-center justify-between">
                <span>Aman Verma</span>
                <span className="text-2xs text-aurora-cyan">₹ INR</span>
              </div>
              <div className="text-2xs text-slate-400">Student (Partner Lock, Age 19)</div>
            </button>

            <button
              type="button"
              onClick={() => performLogin("sarah@demo.com", "password123")}
              className="p-2.5 rounded-xl bg-midnight-950 hover:bg-midnight-800 border border-midnight-800 hover:border-aurora-green text-left transition"
            >
              <div className="text-xs font-bold text-white flex items-center justify-between">
                <span>Sarah Jenkins</span>
                <span className="text-2xs text-aurora-green">$ USD</span>
              </div>
              <div className="text-2xs text-slate-400">Family Parent (Age 38)</div>
            </button>

            <button
              type="button"
              onClick={() => performLogin("leo@demo.com", "password123")}
              className="p-2.5 rounded-xl bg-midnight-950 hover:bg-midnight-800 border border-midnight-800 hover:border-aurora-pink text-left transition"
            >
              <div className="text-xs font-bold text-white flex items-center justify-between">
                <span>Leo Jenkins</span>
                <span className="text-2xs text-aurora-pink">$ USD</span>
              </div>
              <div className="text-2xs text-slate-400">Family Child (Age 10)</div>
            </button>
          </div>
        </div>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-midnight-800"></div>
          <span className="flex-shrink mx-4 text-2xs uppercase tracking-wider text-slate-500 font-semibold">
            Or sign in with email
          </span>
          <div className="flex-grow border-t border-midnight-800"></div>
        </div>

        <form className="space-y-4" onSubmit={handleFormSubmit}>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl font-bold text-midnight-950 bg-gradient-to-r from-aurora-green via-aurora-cyan to-aurora-electric shadow-glow hover:opacity-90 transition disabled:opacity-50 text-sm"
          >
            {isLoading ? "Signing in..." : "Sign In →"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          Don't have an account?{" "}
          <Link to="/register" className="text-aurora-cyan font-semibold hover:underline">
            Register for free
          </Link>
        </p>
      </div>
    </div>
  );
};
