import React, { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { apiRequest } from "../api";

export const GoalsPage: React.FC = () => {
  const { goals, fetchGoals, formatMoney } = useStore();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);

  // Modal states
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");

  const [isSpendOpen, setIsSpendOpen] = useState(false);
  const [spendAmount, setSpendAmount] = useState("");
  const [spendNote, setSpendNote] = useState("Café Latte & Bakery");

  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawFeedback, setWithdrawFeedback] = useState<any | null>(null);

  // Form state for creating goal
  const [name, setName] = useState("");
  const [category, setCategory] = useState("gadget");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState(
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [icon, setIcon] = useState("🎯");
  const [autoSaveAmount, setAutoSaveAmount] = useState("");
  const [autoSaveFrequency, setAutoSaveFrequency] = useState("weekly");
  const [roundUpEnabled, setRoundUpEnabled] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiRequest("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          name,
          category,
          targetAmount: parseFloat(targetAmount),
          deadline,
          priority,
          icon,
          autoSaveAmount: autoSaveAmount ? parseFloat(autoSaveAmount) : 0,
          autoSaveFrequency,
          roundUpEnabled
        })
      });

      setIsCreateOpen(false);
      setName("");
      setTargetAmount("");
      await fetchGoals();
    } catch (err: any) {
      alert(err.message || "Failed to create goal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/api/goals/${selectedGoal.id}/deposit`, {
        method: "POST",
        body: JSON.stringify({ amount: parseFloat(depositAmount) })
      });
      setIsDepositOpen(false);
      setDepositAmount("");
      setSelectedGoal(null);
      await fetchGoals();
    } catch (err: any) {
      alert(err.message || "Failed to make deposit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    setIsSubmitting(true);
    try {
      const res = await apiRequest(`/api/goals/${selectedGoal.id}/simulate-spend`, {
        method: "POST",
        body: JSON.stringify({
          spendAmount: parseFloat(spendAmount),
          note: spendNote
        })
      });
      alert(`Spent ${formatMoney(Math.round(res.spendAmount * 100))} + Rounded up ${formatMoney(Math.round(res.roundUpAmount * 100))} into "${selectedGoal.name}"!`);
      setIsSpendOpen(false);
      setSpendAmount("");
      setSelectedGoal(null);
      await fetchGoals();
    } catch (err: any) {
      alert(err.message || "Failed to simulate spend");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    setIsSubmitting(true);
    try {
      const res = await apiRequest(`/api/goals/${selectedGoal.id}/withdraw`, {
        method: "POST",
        body: JSON.stringify({
          amount: parseFloat(withdrawAmount),
          reason: withdrawReason
        })
      });
      setWithdrawFeedback(res);
      await fetchGoals();
    } catch (err: any) {
      alert(err.message || "Withdrawal failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGoal = async (goalId: number) => {
    if (!confirm("Are you sure you want to cancel this goal? Any saved funds will be returned to your Everyday wallet.")) return;
    try {
      await apiRequest(`/api/goals/${goalId}`, { method: "DELETE" });
      await fetchGoals();
    } catch (err: any) {
      alert(err.message || "Failed to delete goal");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Your Life Goals</h1>
          <p className="text-sm text-slate-400 mt-1">
            Unlimited milestone planning with auto-pacing, round-up savings, and self-discipline protection
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-5 py-2.5 rounded-xl font-bold text-midnight-950 bg-gradient-to-r from-aurora-green via-aurora-cyan to-aurora-electric shadow-glow-sm hover:opacity-90 transition text-sm flex items-center space-x-2 self-start sm:self-auto"
        >
          <span>+ Create New Goal</span>
        </button>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((g: any) => (
          <div
            key={g.id}
            className="p-6 rounded-3xl bg-midnight-900/80 border border-midnight-800 hover:border-aurora-cyan/50 transition shadow-xl space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-4">
              {/* Header card info */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl p-2.5 rounded-2xl bg-midnight-950 border border-midnight-800">
                    {g.icon || "🎯"}
                  </span>
                  <div>
                    <h2 className="font-bold text-white text-base leading-snug">{g.name}</h2>
                    <span className="text-2xs uppercase tracking-wider text-slate-400 font-semibold">
                      {g.category} · Due {g.deadline}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-2xs font-bold px-2 py-0.5 rounded-full ${
                    g.status === "completed"
                      ? "bg-aurora-green/20 text-aurora-green"
                      : g.pacing?.onTrack
                      ? "bg-aurora-cyan/20 text-aurora-cyan"
                      : "bg-aurora-pink/20 text-aurora-pink"
                  }`}
                >
                  {g.status === "completed" ? "Achieved 🎉" : g.pacing?.onTrack ? "On Track" : "Behind"}
                </span>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-300">{formatMoney(g.currentCents)} saved</span>
                  <span className="text-aurora-cyan">{g.pacing?.percent || 0}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-midnight-950 overflow-hidden shadow-inner">
                  <div
                    style={{ width: `${g.pacing?.percent || 0}%` }}
                    className={`h-full rounded-full transition-all ${
                      g.pacing?.percent >= 100
                        ? "bg-gradient-to-r from-aurora-green to-aurora-cyan"
                        : "bg-gradient-to-r from-aurora-electric to-aurora-cyan"
                    }`}
                  />
                </div>
                <div className="flex justify-between text-2xs text-slate-400 mt-1">
                  <span>Target: {formatMoney(g.targetCents)}</span>
                  <span>{g.pacing?.daysRemaining || 0} days remaining</span>
                </div>
              </div>

              {/* Celebration message */}
              <div className="p-2.5 rounded-xl bg-midnight-950/80 border border-midnight-800 text-xs text-slate-300">
                {g.pacing?.milestoneMessage || "Keep up the great momentum!"}
              </div>

              {/* Weekly / Monthly pacing breakdown */}
              <div className="p-3 rounded-xl bg-midnight-950/90 border border-midnight-800 grid grid-cols-2 gap-3 text-2xs">
                <div>
                  <span className="text-slate-500 block">Required / Week:</span>
                  <span className="text-white font-bold">{formatMoney(g.pacing?.requiredPerWeekCents || 0)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Required / Month:</span>
                  <span className="text-white font-bold">{formatMoney(g.pacing?.requiredPerMonthCents || 0)}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-midnight-800 text-slate-400">
                  Projected Completion: <span className="text-aurora-cyan font-semibold">{g.pacing?.projectedCompletionDate}</span>
                </div>
              </div>

              {/* Milestones (25/50/75/100%) */}
              <div className="flex items-center justify-between text-2xs pt-1 border-t border-midnight-800/80">
                <span className="text-slate-400">Milestone Badges:</span>
                <div className="flex items-center space-x-1.5">
                  <span className={`px-2 py-0.5 rounded text-2xs font-bold ${g.pacing?.milestones?.m25 ? "bg-aurora-green/20 text-aurora-green" : "text-slate-600 bg-midnight-950"}`}>
                    25%
                  </span>
                  <span className={`px-2 py-0.5 rounded text-2xs font-bold ${g.pacing?.milestones?.m50 ? "bg-aurora-cyan/20 text-aurora-cyan" : "text-slate-600 bg-midnight-950"}`}>
                    50%
                  </span>
                  <span className={`px-2 py-0.5 rounded text-2xs font-bold ${g.pacing?.milestones?.m75 ? "bg-aurora-electric/20 text-aurora-electric" : "text-slate-600 bg-midnight-950"}`}>
                    75%
                  </span>
                  <span className={`px-2 py-0.5 rounded text-2xs font-bold ${g.pacing?.milestones?.m100 ? "bg-aurora-pink/20 text-aurora-pink" : "text-slate-600 bg-midnight-950"}`}>
                    100% 🏆
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-midnight-800/80 space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => {
                    setSelectedGoal(g);
                    setIsDepositOpen(true);
                  }}
                  className="px-2 py-2 rounded-xl text-xs font-bold text-midnight-950 bg-aurora-green hover:opacity-90 transition text-center"
                >
                  + Deposit
                </button>

                <button
                  onClick={() => {
                    setSelectedGoal(g);
                    setIsSpendOpen(true);
                  }}
                  className="px-2 py-2 rounded-xl text-xs font-bold text-white bg-midnight-800 hover:bg-midnight-700 border border-midnight-700 transition text-center"
                  title="Simulate purchase with spare change round-up"
                >
                  🛒 Round-Up
                </button>

                <button
                  onClick={() => {
                    setSelectedGoal(g);
                    setWithdrawAmount((g.currentCents / 100).toString());
                    setWithdrawFeedback(null);
                    setIsWithdrawOpen(true);
                  }}
                  className="px-2 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-midnight-950 hover:bg-midnight-800 border border-midnight-800 transition text-center"
                >
                  Withdraw
                </button>
              </div>

              <div className="text-right">
                <button
                  onClick={() => handleDeleteGoal(g.id)}
                  className="text-2xs text-slate-500 hover:text-aurora-pink transition"
                >
                  Delete Goal
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Goal Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="max-w-lg w-full bg-midnight-900 p-6 rounded-3xl border border-midnight-800 shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Create a New Life Goal</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kyoto Trip, Coding Laptop, Emergency Shield"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
                  >
                    <option value="education">Education</option>
                    <option value="gadget">Gadget / Tech</option>
                    <option value="travel">Travel</option>
                    <option value="emergency">Emergency</option>
                    <option value="business">Business</option>
                    <option value="health">Health</option>
                    <option value="wedding">Wedding</option>
                    <option value="home">Home</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Amount</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="50000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Deadline Date</label>
                  <input
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Icon / Emoji</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-midnight-950 border border-midnight-800 space-y-2">
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roundUpEnabled}
                    onChange={(e) => setRoundUpEnabled(e.target.checked)}
                    className="rounded text-aurora-cyan focus:ring-0"
                  />
                  <span>Enable Micro-Savings Round-Up (rounds up simulated purchases to this goal)</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-midnight-950 bg-gradient-to-r from-aurora-green to-aurora-cyan shadow-glow-sm hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Save Goal →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {isDepositOpen && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-midnight-900 p-6 rounded-3xl border border-midnight-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Deposit to "{selectedGoal.name}"</h2>
              <button onClick={() => setIsDepositOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Deposit Amount (from Everyday Wallet)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="1000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsDepositOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-midnight-950 bg-aurora-green hover:opacity-90 disabled:opacity-50"
                >
                  Deposit Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Spend & Round Up Modal */}
      {isSpendOpen && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-midnight-900 p-6 rounded-3xl border border-midnight-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">🛒 Simulate Card Purchase</h2>
              <button onClick={() => setIsSpendOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <p className="text-xs text-slate-400">
              Deducts purchase amount from Everyday wallet. The spare change is automatically rounded up and credited to "{selectedGoal.name}".
            </p>
            <form onSubmit={handleSimulateSpend} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Purchase Note</label>
                <input
                  type="text"
                  required
                  value={spendNote}
                  onChange={(e) => setSpendNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Purchase Amount (e.g. 240.50)</label>
                <input
                  type="number"
                  min="0.5"
                  step="any"
                  required
                  placeholder="240.50"
                  value={spendAmount}
                  onChange={(e) => setSpendAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSpendOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-midnight-950 bg-aurora-cyan hover:opacity-90 disabled:opacity-50"
                >
                  Simulate Purchase & Round-Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal & Self-Discipline Cooling-Off */}
      {isWithdrawOpen && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-midnight-900 p-6 rounded-3xl border border-midnight-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Withdrawal: "{selectedGoal.name}"</h2>
              <button onClick={() => setIsWithdrawOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {withdrawFeedback ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-midnight-950 border border-aurora-electric/40 space-y-2">
                  <div className="text-sm font-bold text-white">
                    {withdrawFeedback.message}
                  </div>
                  {withdrawFeedback.delayMessage && (
                    <div className="text-xs text-aurora-pink">
                      ⚠️ {withdrawFeedback.delayMessage}
                    </div>
                  )}
                  {withdrawFeedback.unlockAt && (
                    <div className="text-xs text-slate-400">
                      Countdown ends at: {new Date(withdrawFeedback.unlockAt).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setIsWithdrawOpen(false);
                      setWithdrawFeedback(null);
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-midnight-950 bg-aurora-green"
                  >
                    Got It
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleWithdraw} className="space-y-4">
                {selectedGoal.currentCents >= selectedGoal.targetCents ? (
                  <div className="p-3.5 rounded-xl bg-aurora-green/15 border border-aurora-green/30 text-xs text-aurora-green font-semibold">
                    🏆 Goal Achieved (100%)! Payout is instant with no cooling-off restrictions.
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-aurora-pink/15 border border-aurora-pink/30 text-xs text-aurora-pink space-y-1">
                    <span className="font-bold block">🛡️ Self-Discipline Guardrail</span>
                    <span>
                      Money in active goals is locked until reached. Early withdrawal requires a 24-hour cooling-off period (or guardian review) to curb impulse spending.
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Amount to Withdraw (Available: {formatMoney(selectedGoal.currentCents)})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedGoal.currentCents / 100}
                    step="any"
                    required
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Withdrawal</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Why are you withdrawing these funds early?"
                    value={withdrawReason}
                    onChange={(e) => setWithdrawReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsWithdrawOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-aurora-pink hover:opacity-90 disabled:opacity-50"
                  >
                    {selectedGoal.currentCents >= selectedGoal.targetCents ? "Withdraw Funds" : "Initiate Early Withdrawal"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
