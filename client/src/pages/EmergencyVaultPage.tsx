import React, { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { apiRequest } from "../api";

export const EmergencyVaultPage: React.FC = () => {
  const { dashboard, fetchDashboard, formatMoney } = useStore();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const runway = dashboard?.runway;
  const balances = dashboard?.balances;

  const handleDepositToVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage(null);
    try {
      // Direct transfer into emergency vault via family fund or custom endpoint
      await apiRequest("/api/family/funds", {
        method: "POST",
        body: JSON.stringify({ amount: parseFloat(depositAmount) })
      });
      setDepositAmount("");
      setMessage("Funds successfully directed to build your Emergency Vault!");
      await fetchDashboard();
    } catch (err: any) {
      setMessage(err.message || "Failed to fund vault");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-midnight-900/60 p-6 rounded-3xl border border-midnight-800 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center space-x-3">
            <span>Emergency Vault & Runway</span>
            <span className="text-2xs px-2.5 py-1 rounded-full bg-aurora-electric/20 text-aurora-electric font-bold">
              3 to 6 Months Cushion
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            An untouchable liquid reserve protecting your peace of mind and family security
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400">Vault Balance</div>
          <div className="text-3xl font-black text-aurora-electric">
            {formatMoney(balances?.emergencyCents || 0)}
          </div>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-2xl bg-aurora-green/10 border border-aurora-green/30 text-aurora-green text-sm">
          {message}
        </div>
      )}

      {/* Runway Analysis Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-6 rounded-3xl bg-midnight-900/80 border border-midnight-800 space-y-6">
          <h2 className="text-lg font-bold text-white">Runway Coverage Gauge</h2>

          <div className="p-4 rounded-2xl bg-midnight-950 border border-midnight-800 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-300 font-semibold">Months of Living Expenses Covered:</span>
              <span className="text-2xl font-black text-aurora-electric">
                {runway?.monthsCovered || 0} Months
              </span>
            </div>

            <div className="w-full h-4 rounded-full bg-midnight-900 overflow-hidden shadow-inner flex">
              <div
                style={{ width: `${Math.min(100, ((runway?.monthsCovered || 0) / 6) * 100)}%` }}
                className="h-full bg-gradient-to-r from-aurora-electric to-aurora-green transition-all"
              />
            </div>

            <div className="flex justify-between text-2xs text-slate-500">
              <span>0 Months (Vulnerable)</span>
              <span>3 Months (Target Baseline)</span>
              <span>6+ Months (Optimal Resilience)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-midnight-950/70 border border-midnight-800">
              <span className="text-slate-500 block mb-1">Baseline 3-Month Target:</span>
              <span className="text-base font-bold text-white">{formatMoney(runway?.targetMinCents || 0)}</span>
            </div>
            <div className="p-4 rounded-2xl bg-midnight-950/70 border border-midnight-800">
              <span className="text-slate-500 block mb-1">Optimal 6-Month Target:</span>
              <span className="text-base font-bold text-aurora-green">{formatMoney(runway?.targetMaxCents || 0)}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-midnight-950 border border-midnight-800 text-xs text-slate-300 leading-relaxed">
            💡 <strong className="text-white">Why Emergency Funds Come First:</strong> Having 3 to 6 months of essential expenses safe in your Emergency Vault ensures you never need to sell goal investments or incur credit card debt when sudden expenses occur.
          </div>
        </div>

        {/* Deposit Quick Action */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-midnight-900/80 border border-midnight-800 space-y-4">
          <h2 className="text-lg font-bold text-white">Fortify Your Vault</h2>
          <p className="text-xs text-slate-400">
            Allocate funds directly into your emergency reserve.
          </p>
          <form onSubmit={handleDepositToVault} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Deposit Amount</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                placeholder="2500"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3 rounded-xl text-xs font-bold text-midnight-950 bg-gradient-to-r from-aurora-electric to-aurora-green hover:opacity-90 disabled:opacity-50 transition shadow-glow-sm"
            >
              {isProcessing ? "Allocating..." : "Add to Emergency Vault →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
