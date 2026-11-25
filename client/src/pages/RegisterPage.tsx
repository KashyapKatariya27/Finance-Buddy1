import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getPresetForAge } from "@finance-buddy/shared";
import { apiRequest } from "../api";
import { useStore } from "../store/useStore";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useStore();

  const queryMode = searchParams.get("mode") as "FAMILY" | "TEEN" | "MYSELF" | null;

  const [accountMode, setAccountMode] = useState<"FAMILY" | "MYSELF" | "TEEN">(queryMode || "FAMILY");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState<number>(accountMode === "FAMILY" ? 35 : accountMode === "TEEN" ? 16 : 25);
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [role, setRole] = useState<"PARENT" | "CHILD" | "INDIVIDUAL">(accountMode === "FAMILY" ? "PARENT" : "INDIVIDUAL");
  const [parentEmail, setParentEmail] = useState("");
  const [accountabilityPartnerEmail, setAccountabilityPartnerEmail] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (queryMode) {
      setAccountMode(queryMode);
      if (queryMode === "FAMILY") {
        setRole("PARENT");
        setAge(35);
      } else if (queryMode === "TEEN") {
        setRole("INDIVIDUAL");
        setAge(16);
      } else {
        setRole("INDIVIDUAL");
        setAge(26);
      }
    }
  }, [queryMode]);

  const preset = getPresetForAge(age);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (accountMode === "MYSELF" && age < 18) {
      setError("Children under 18 must use a Family or Teen account guided by a guardian.");
      setIsSubmitting(false);
      return;
    }

    try {
      const data = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          email,
          password,
          accountMode,
          role,
          age,
          currency,
          parentEmail: parentEmail || undefined,
          accountabilityPartnerEmail: accountabilityPartnerEmail || undefined
        })
      });

      setUser(data.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-8 bg-midnight-900/80 p-8 rounded-3xl border border-midnight-800 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-aurora-electric to-aurora-green mx-auto flex items-center justify-center shadow-glow-sm">
            <span className="text-midnight-950 font-black text-2xl">✨</span>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold text-white">Create your Account</h1>
          <p className="mt-2 text-sm text-slate-400">
            Start saving for every milestone with goal-first intelligence
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-aurora-pink/10 border border-aurora-pink/30 text-aurora-pink text-sm">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          {/* Account Mode Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              How will you use FinanceBuddy?
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAccountMode("FAMILY");
                  setRole("PARENT");
                  if (age < 18) setAge(35);
                }}
                className={`p-3 rounded-xl border text-center transition ${
                  accountMode === "FAMILY"
                    ? "bg-midnight-800 border-aurora-green text-white shadow-glow-sm"
                    : "bg-midnight-950 border-midnight-800 text-slate-400 hover:text-white"
                }`}
              >
                <div className="text-xl">👨‍👩‍👦</div>
                <div className="text-xs font-bold mt-1">Family</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAccountMode("MYSELF");
                  setRole("INDIVIDUAL");
                  if (age < 18) setAge(25);
                }}
                className={`p-3 rounded-xl border text-center transition ${
                  accountMode === "MYSELF"
                    ? "bg-midnight-800 border-aurora-electric text-white shadow-glow-sm"
                    : "bg-midnight-950 border-midnight-800 text-slate-400 hover:text-white"
                }`}
              >
                <div className="text-xl">👤</div>
                <div className="text-xs font-bold mt-1">Myself</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAccountMode("TEEN");
                  setRole("INDIVIDUAL");
                  setAge(16);
                }}
                className={`p-3 rounded-xl border text-center transition ${
                  accountMode === "TEEN"
                    ? "bg-midnight-800 border-aurora-cyan text-white shadow-glow-sm"
                    : "bg-midnight-950 border-midnight-800 text-slate-400 hover:text-white"
                }`}
              >
                <div className="text-xl">🎓</div>
                <div className="text-xs font-bold mt-1">Student</div>
              </button>
            </div>
          </div>

          {/* Sub-toggle for Family mode: Parent vs Child */}
          {accountMode === "FAMILY" && (
            <div className="flex items-center space-x-4 p-3 rounded-xl bg-midnight-950 border border-midnight-800">
              <span className="text-xs font-semibold text-slate-400">Family Role:</span>
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="familyRole"
                  checked={role === "PARENT"}
                  onChange={() => {
                    setRole("PARENT");
                    setAge(35);
                  }}
                  className="text-aurora-green focus:ring-0"
                />
                <span>Parent / Guardian</span>
              </label>
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="familyRole"
                  checked={role === "CHILD"}
                  onChange={() => {
                    setRole("CHILD");
                    setAge(10);
                  }}
                  className="text-aurora-green focus:ring-0"
                />
                <span>Child (Supervised)</span>
              </label>
            </div>
          )}

          {/* Full Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Riya Sharma"
                className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="riya@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
              />
            </div>
          </div>

          {/* Password & Age */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Age: <span className="text-aurora-green font-bold">{age} years</span>
              </label>
              <input
                type="number"
                min={accountMode === "MYSELF" ? 18 : 6}
                max={100}
                required
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value, 10) || 18)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
              />
            </div>
          </div>

          {/* Preset Preview Badge */}
          <div className="p-3.5 rounded-xl bg-midnight-950/80 border border-midnight-800 flex items-center justify-between">
            <div className="text-xs">
              <span className="text-slate-400">Recommended Allocation Preset: </span>
              <span className="text-aurora-cyan font-bold">{preset.label}</span>
            </div>
            <div className="text-xs font-mono text-slate-300">
              <span className="text-aurora-green">{preset.everyday}% Everyday</span> ·{" "}
              <span className="text-aurora-electric">{preset.emergency}% Emergency</span> ·{" "}
              <span className="text-aurora-cyan">{preset.savings}% Goals</span>
            </div>
          </div>

          {/* Parent Email (if child) */}
          {role === "CHILD" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Parent / Guardian Email (Optional)
              </label>
              <input
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder="parent@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
              />
            </div>
          )}

          {/* Accountability Partner (if Teen/Student) */}
          {accountMode === "TEEN" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Accountability Partner Email (Optional)
              </label>
              <input
                type="email"
                value={accountabilityPartnerEmail}
                onChange={(e) => setAccountabilityPartnerEmail(e.target.value)}
                placeholder="mentor@example.com (will review early goal withdrawals)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
              />
            </div>
          )}

          {/* Currency selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Preferred Currency</label>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setCurrency("INR")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                  currency === "INR"
                    ? "bg-aurora-electric text-midnight-950 border-aurora-electric"
                    : "bg-midnight-950 text-slate-300 border-midnight-800"
                }`}
              >
                ₹ INR (Indian Rupee)
              </button>
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                  currency === "USD"
                    ? "bg-aurora-electric text-midnight-950 border-aurora-electric"
                    : "bg-midnight-950 text-slate-300 border-midnight-800"
                }`}
              >
                $ USD (US Dollar)
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl font-bold text-midnight-950 bg-gradient-to-r from-aurora-green via-aurora-cyan to-aurora-electric shadow-glow hover:opacity-90 transition disabled:opacity-50 text-sm"
          >
            {isSubmitting ? "Creating account..." : "Complete Registration →"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          Already have an account?{" "}
          <Link to="/login" className="text-aurora-cyan font-semibold hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
};
