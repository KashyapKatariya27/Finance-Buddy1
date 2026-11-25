import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store/useStore";
import { apiRequest } from "../api";

export const DashboardPage: React.FC = () => {
  const { user, dashboard, fetchDashboard, formatMoney } = useStore();

  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState("");
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitEveryday, setSplitEveryday] = useState(50);
  const [splitEmergency, setSplitEmergency] = useState(20);
  const [splitSavings, setSplitSavings] = useState(30);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (dashboard?.split) {
      setSplitEveryday(dashboard.split.everyday);
      setSplitEmergency(dashboard.split.emergency);
      setSplitSavings(dashboard.split.savings);
    }
  }, [dashboard]);

  if (!dashboard) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-aurora-cyan border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading your Midnight Aurora dashboard...</p>
        </div>
      </div>
    );
  }

  const { balances, runway, goals, approvals, recentTransactions } = dashboard;

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setActionMessage(null);
    try {
      await apiRequest("/api/family/funds", {
        method: "POST",
        body: JSON.stringify({ amount: parseFloat(addFundsAmount) })
      });
      setAddFundsAmount("");
      setIsAddFundsOpen(false);
      setActionMessage("Funds added and auto-allocated according to your plan split!");
      await fetchDashboard();
    } catch (err: any) {
      setActionMessage(err.message || "Failed to add funds");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (splitEveryday + splitEmergency + splitSavings !== 100) {
      alert("Split percentages must add up to 100%");
      return;
    }
    setIsProcessing(true);
    try {
      await apiRequest("/api/plan-split", {
        method: "POST",
        body: JSON.stringify({
          everyday: splitEveryday,
          emergency: splitEmergency,
          savings: splitSavings
        })
      });
      setIsSplitModalOpen(false);
      setActionMessage("Allocation plan updated successfully!");
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || "Failed to update split");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReviewApproval = async (approvalId: number, decision: "approved" | "rejected") => {
    try {
      await apiRequest(`/api/approvals/${approvalId}/review`, {
        method: "POST",
        body: JSON.stringify({ decision })
      });
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || "Failed to review approval");
    }
  };

  const handleFinalizeCoolingOff = async (approvalId: number, simulateBypass = false) => {
    try {
      await apiRequest(`/api/approvals/${approvalId}/finalize-cooling-off`, {
        method: "POST",
        body: JSON.stringify({ simulateBypass })
      });
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || "Failed to finalize cooling off");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Welcome banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-midnight-900/60 p-6 rounded-3xl border border-midnight-800 backdrop-blur-xl">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Welcome back, {user?.fullName || "Pioneer"}!
            </h1>
            <span className="text-xs px-2.5 py-1 rounded-full bg-aurora-cyan/15 text-aurora-cyan font-semibold border border-aurora-cyan/30">
              {user?.accountMode === "MYSELF" ? "Individual" : user?.accountMode === "TEEN" ? "Student" : user?.role}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Track your goal velocity and safeguard your emergency runway
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsAddFundsOpen(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-midnight-950 bg-gradient-to-r from-aurora-green to-aurora-cyan shadow-glow-sm hover:opacity-90 transition text-sm flex items-center space-x-1.5"
          >
            <span>+ Add Funds</span>
          </button>
          <Link
            to="/goals"
            className="px-4 py-2.5 rounded-xl font-semibold text-white bg-midnight-800 hover:bg-midnight-700 border border-midnight-700 transition text-sm"
          >
            View All Goals →
          </Link>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-2xl bg-aurora-green/10 border border-aurora-green/30 text-aurora-green text-sm flex justify-between items-center">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-xs text-slate-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Balances Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Everyday Wallet */}
        <div className="p-6 rounded-3xl bg-midnight-900/70 border border-midnight-800/80 hover:border-aurora-green/40 transition shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Everyday Spendable</span>
            <span className="text-xl">💳</span>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">
            {formatMoney(balances.everydayCents)}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Instant liquidity for daily essentials & simulated purchases
          </p>
          <div className="mt-4 pt-3 border-t border-midnight-800/80 flex items-center justify-between text-xs">
            <span className="text-aurora-green font-semibold">{dashboard.split.everyday}% of incoming funds</span>
            <span className="text-slate-500">Unrestricted</span>
          </div>
        </div>

        {/* Emergency Vault */}
        <div className="p-6 rounded-3xl bg-midnight-900/70 border border-midnight-800/80 hover:border-aurora-electric/40 transition shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Emergency Vault</span>
            <span className="text-xl">🏦</span>
          </div>
          <div className="text-3xl font-black text-aurora-electric tracking-tight">
            {formatMoney(balances.emergencyCents)}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {runway.guidance}
          </p>
          <div className="mt-4 pt-3 border-t border-midnight-800/80 flex items-center justify-between text-xs">
            <span className="font-semibold text-white">
              {runway.monthsCovered} mo. covered
            </span>
            <span className={`px-2 py-0.5 rounded text-2xs font-bold ${
              runway.isAdequate ? "bg-aurora-green/20 text-aurora-green" : "bg-aurora-pink/20 text-aurora-pink"
            }`}>
              {runway.isAdequate ? "Adequate Runway" : "Target: 3-6 Mo"}
            </span>
          </div>
        </div>

        {/* Savings Goals Total */}
        <div className="p-6 rounded-3xl bg-midnight-900/70 border border-midnight-800/80 hover:border-aurora-cyan/40 transition shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Active Goal Savings</span>
            <span className="text-xl">🎯</span>
          </div>
          <div className="text-3xl font-black text-aurora-cyan tracking-tight">
            {formatMoney(balances.savingsCents)}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Protected under self-discipline & milestone locks
          </p>
          <div className="mt-4 pt-3 border-t border-midnight-800/80 flex items-center justify-between text-xs">
            <span className="text-aurora-cyan font-semibold">{goals.length} active goal{goals.length !== 1 ? "s" : ""}</span>
            <Link to="/goals" className="text-aurora-cyan hover:underline">
              Manage Goals →
            </Link>
          </div>
        </div>
      </div>

      {/* Plan Split Bar */}
      <div className="p-6 rounded-3xl bg-midnight-900/60 border border-midnight-800 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span>Age-Aware Allocation Split</span>
              <span className="text-xs font-medium text-slate-400">({dashboard.split.presetRecommendation?.label})</span>
            </h2>
            <p className="text-xs text-slate-400">
              Every incoming deposit is automatically divided into these 3 protected jars
            </p>
          </div>
          <button
            onClick={() => setIsSplitModalOpen(true)}
            className="text-xs font-semibold text-aurora-cyan hover:text-white px-3 py-1.5 rounded-lg bg-midnight-800 border border-midnight-700 transition self-start sm:self-auto"
          >
            Customize Percentages ⚙️
          </button>
        </div>

        {/* Visual Bar */}
        <div className="w-full h-4 rounded-full bg-midnight-950 overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${dashboard.split.everyday}%` }}
            className="h-full bg-aurora-green transition-all"
            title={`Everyday: ${dashboard.split.everyday}%`}
          />
          <div
            style={{ width: `${dashboard.split.emergency}%` }}
            className="h-full bg-aurora-electric transition-all"
            title={`Emergency: ${dashboard.split.emergency}%`}
          />
          <div
            style={{ width: `${dashboard.split.savings}%` }}
            className="h-full bg-aurora-cyan transition-all"
            title={`Savings: ${dashboard.split.savings}%`}
          />
        </div>

        <div className="flex items-center justify-between mt-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-aurora-green" />
            <span className="text-slate-300 font-medium">Everyday: {dashboard.split.everyday}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-aurora-electric" />
            <span className="text-slate-300 font-medium">Emergency Vault: {dashboard.split.emergency}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-aurora-cyan" />
            <span className="text-slate-300 font-medium">Goal Savings: {dashboard.split.savings}%</span>
          </div>
        </div>
      </div>

      {/* Pending Approvals / Cooling-Off Alerts */}
      {((approvals.incoming && approvals.incoming.length > 0) || (approvals.outgoing && approvals.outgoing.length > 0)) && (
        <div className="p-6 rounded-3xl bg-midnight-900/60 border border-aurora-electric/30 backdrop-blur-xl space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>🛡️ Guardrail Approvals & Cooling-Off Locks</span>
          </h2>

          {/* Incoming reviews for Parent or Partner */}
          {approvals.incoming && approvals.incoming.map((appr: any) => (
            <div key={appr.id} className="p-4 rounded-2xl bg-midnight-950 border border-midnight-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-aurora-electric uppercase tracking-wider">
                  Review Required · {appr.type.replace(/_/g, " ")}
                </span>
                <p className="text-sm font-semibold text-white mt-1">
                  Reason: "{appr.reason}" ({formatMoney(appr.amountCents)})
                </p>
                {appr.delayDays > 0 && (
                  <p className="text-xs text-aurora-pink mt-0.5">
                    ⚠️ Early withdrawal will delay this goal by ~{appr.delayDays} days.
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleReviewApproval(appr.id, "approved")}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-midnight-950 bg-aurora-green hover:opacity-90 transition"
                >
                  Approve Payout
                </button>
                <button
                  onClick={() => handleReviewApproval(appr.id, "rejected")}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-midnight-800 hover:bg-midnight-700 border border-midnight-700 transition"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}

          {/* Outgoing Cooling-Off locks for user */}
          {approvals.outgoing && approvals.outgoing.filter((o: any) => o.status === "cooling_off").map((cool: any) => (
            <div key={cool.id} className="p-4 rounded-2xl bg-midnight-950 border border-aurora-pink/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-aurora-pink animate-ping" />
                  <span className="text-xs font-bold text-aurora-pink uppercase tracking-wider">
                    24-Hour Self-Discipline Cooling-Off Active
                  </span>
                </div>
                <p className="text-sm font-semibold text-white mt-1">
                  Requested withdrawal of {formatMoney(cool.amountCents)} for "{cool.reason}"
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Unlocks automatically on: {new Date(cool.unlockAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleFinalizeCoolingOff(cool.id, true)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-midnight-800 hover:bg-midnight-700 border border-midnight-700 transition"
                  title="Simulates 24h timer expiration for demo testing"
                >
                  Bypass Timer (Demo Mode)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Goals Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Your Primary Goals</h2>
          <Link to="/goals" className="text-xs font-semibold text-aurora-cyan hover:underline">
            + Create New Goal
          </Link>
        </div>

        {goals.length === 0 ? (
          <div className="p-8 rounded-3xl bg-midnight-900/60 border border-midnight-800 text-center space-y-3">
            <span className="text-4xl">🎯</span>
            <h3 className="text-base font-bold text-white">No active goals yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              FinanceBuddy is goal-first! Create a goal for a gadget, vacation, education, or emergency reserve.
            </p>
            <Link
              to="/goals"
              className="inline-block px-4 py-2 rounded-xl text-xs font-bold text-midnight-950 bg-aurora-green hover:opacity-90 transition"
            >
              Set First Goal →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {goals.map((g: any) => (
              <div key={g.id} className="p-6 rounded-3xl bg-midnight-900/70 border border-midnight-800 hover:border-aurora-cyan/50 transition shadow-lg space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-3xl p-2.5 rounded-2xl bg-midnight-950 border border-midnight-800">
                      {g.icon || "🎯"}
                    </span>
                    <div>
                      <h3 className="font-bold text-white text-base">{g.name}</h3>
                      <span className="text-2xs uppercase tracking-wider text-slate-400 font-semibold">
                        {g.category} · Due {g.deadline}
                      </span>
                    </div>
                  </div>
                  <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${
                    g.pacing?.onTrack ? "bg-aurora-green/20 text-aurora-green" : "bg-aurora-pink/20 text-aurora-pink"
                  }`}>
                    {g.pacing?.onTrack ? "On Track" : "Behind"}
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-400">{formatMoney(g.currentCents)} saved</span>
                    <span className="text-aurora-cyan">{g.pacing?.percent || 0}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-midnight-950 overflow-hidden shadow-inner">
                    <div
                      style={{ width: `${g.pacing?.percent || 0}%` }}
                      className="h-full bg-gradient-to-r from-aurora-cyan to-aurora-green rounded-full transition-all"
                    />
                  </div>
                  <div className="text-right text-2xs text-slate-500 mt-1">
                    Target: {formatMoney(g.targetCents)}
                  </div>
                </div>

                {/* Pacing statistics */}
                <div className="p-3 rounded-xl bg-midnight-950/80 border border-midnight-800/80 grid grid-cols-2 gap-2 text-2xs">
                  <div>
                    <span className="text-slate-500 block">Required / Week:</span>
                    <span className="text-white font-bold">{formatMoney(g.pacing?.requiredPerWeekCents || 0)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Required / Month:</span>
                    <span className="text-white font-bold">{formatMoney(g.pacing?.requiredPerMonthCents || 0)}</span>
                  </div>
                </div>

                {/* Milestone celebration badges */}
                <div className="flex items-center justify-between pt-2 border-t border-midnight-800/80 text-2xs">
                  <span className="text-slate-400">Milestones:</span>
                  <div className="flex items-center space-x-1">
                    <span className={`px-1.5 py-0.5 rounded ${g.pacing?.milestones?.m25 ? "bg-aurora-green/20 text-aurora-green font-bold" : "text-slate-600"}`}>25%</span>
                    <span className={`px-1.5 py-0.5 rounded ${g.pacing?.milestones?.m50 ? "bg-aurora-cyan/20 text-aurora-cyan font-bold" : "text-slate-600"}`}>50%</span>
                    <span className={`px-1.5 py-0.5 rounded ${g.pacing?.milestones?.m75 ? "bg-aurora-electric/20 text-aurora-electric font-bold" : "text-slate-600"}`}>75%</span>
                    <span className={`px-1.5 py-0.5 rounded ${g.pacing?.milestones?.m100 ? "bg-aurora-pink/20 text-aurora-pink font-bold" : "text-slate-600"}`}>100%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Funds Modal */}
      {isAddFundsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-midnight-900 p-6 rounded-3xl border border-midnight-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">+ Add Simulated Funds</h3>
              <button onClick={() => setIsAddFundsOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <p className="text-xs text-slate-400">
              Funds are automatically split across Everyday ({dashboard.split.everyday}%), Emergency ({dashboard.split.emergency}%), and Savings ({dashboard.split.savings}%).
            </p>
            <form onSubmit={handleAddFunds} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Deposit Amount</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="5000"
                  value={addFundsAmount}
                  onChange={(e) => setAddFundsAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddFundsOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-midnight-950 bg-aurora-green hover:opacity-90 disabled:opacity-50"
                >
                  {isProcessing ? "Processing..." : "Allocate Funds →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customize Split Modal */}
      {isSplitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-midnight-900 p-6 rounded-3xl border border-midnight-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Customize Allocation Percentages</h3>
              <button onClick={() => setIsSplitModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <p className="text-xs text-slate-400">
              Adjust how future incoming deposits divide into your 3 jars. Total must equal 100%.
            </p>
            <form onSubmit={handleUpdateSplit} className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Everyday Jar</span>
                  <span className="font-bold text-aurora-green">{splitEveryday}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={splitEveryday}
                  onChange={(e) => setSplitEveryday(parseInt(e.target.value, 10))}
                  className="w-full accent-aurora-green"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Emergency Vault Jar</span>
                  <span className="font-bold text-aurora-electric">{splitEmergency}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={splitEmergency}
                  onChange={(e) => setSplitEmergency(parseInt(e.target.value, 10))}
                  className="w-full accent-aurora-electric"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Goal Savings Jar</span>
                  <span className="font-bold text-aurora-cyan">{splitSavings}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={splitSavings}
                  onChange={(e) => setSplitSavings(parseInt(e.target.value, 10))}
                  className="w-full accent-aurora-cyan"
                />
              </div>

              <div className="p-3 rounded-xl bg-midnight-950 border border-midnight-800 flex justify-between text-xs font-bold">
                <span>Sum Total:</span>
                <span className={splitEveryday + splitEmergency + splitSavings === 100 ? "text-aurora-green" : "text-aurora-pink"}>
                  {splitEveryday + splitEmergency + splitSavings}% / 100%
                </span>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSplitModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={splitEveryday + splitEmergency + splitSavings !== 100 || isProcessing}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-midnight-950 bg-aurora-cyan hover:opacity-90 disabled:opacity-50"
                >
                  Save Split Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
