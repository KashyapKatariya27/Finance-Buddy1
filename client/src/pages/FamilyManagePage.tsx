import React, { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { apiRequest } from "../api";

export const FamilyManagePage: React.FC = () => {
  const { formatMoney } = useStore();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any | null>(null);
  const [allowanceAmount, setAllowanceAmount] = useState("");
  const [isFunding, setIsFunding] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Add Child Modal
  const [isAddChildOpen, setIsAddChildOpen] = useState(false);
  const [childName, setChildName] = useState("");
  const [childEmail, setChildEmail] = useState("");
  const [childPassword, setChildPassword] = useState("");
  const [childAge, setChildAge] = useState(12);
  const [isCreatingChild, setIsCreatingChild] = useState(false);

  const fetchChildren = async () => {
    try {
      const res = await apiRequest("/api/children");
      setChildren(res.children || []);
    } catch (e) {
      console.error("Failed to load children:", e);
    }
  };

  useEffect(() => {
    fetchChildren();
  }, []);

  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingChild(true);
    setStatusMsg(null);
    try {
      await apiRequest("/api/children", {
        method: "POST",
        body: JSON.stringify({
          fullName: childName,
          email: childEmail,
          password: childPassword,
          age: childAge
        })
      });
      setStatusMsg(`Child account created for ${childName}!`);
      setIsAddChildOpen(false);
      setChildName("");
      setChildEmail("");
      setChildPassword("");
      await fetchChildren();
    } catch (err: any) {
      alert(err.message || "Failed to create child account");
    } finally {
      setIsCreatingChild(false);
    }
  };

  const handleFundChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) return;
    setIsFunding(true);
    setStatusMsg(null);

    try {
      await apiRequest("/api/family/funds", {
        method: "POST",
        body: JSON.stringify({
          targetUserId: selectedChild.id,
          amount: parseFloat(allowanceAmount)
        })
      });
      setStatusMsg(`Successfully funded ${selectedChild.fullName} with ${allowanceAmount}!`);
      setAllowanceAmount("");
      setSelectedChild(null);
      await fetchChildren();
    } catch (err: any) {
      setStatusMsg(err.message || "Failed to fund child");
    } finally {
      setIsFunding(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="bg-midnight-900/60 p-6 rounded-3xl border border-midnight-800 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center space-x-3">
            <span>Family Guardian Hub</span>
            <span className="text-2xs px-2.5 py-1 rounded-full bg-aurora-green/20 text-aurora-green font-bold">
              Parent Mode
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Supervise your children's goal milestones, fund allowances with auto-splits, and approve withdrawals
          </p>
        </div>
        <button
          onClick={() => setIsAddChildOpen(true)}
          className="px-4 py-2.5 rounded-xl font-bold text-midnight-950 bg-gradient-to-r from-aurora-green to-aurora-cyan shadow-glow-sm hover:opacity-90 transition text-sm"
        >
          + Add Child Account
        </button>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-2xl bg-aurora-green/10 border border-aurora-green/30 text-aurora-green text-sm">
          {statusMsg}
        </div>
      )}

      {/* Children list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {children.map((child) => (
          <div
            key={child.id}
            className="p-6 rounded-3xl bg-midnight-900/80 border border-midnight-800 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-aurora-cyan/15 border border-aurora-cyan/30 flex items-center justify-center text-2xl">
                  👦
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{child.fullName}</h2>
                  <span className="text-xs text-slate-400">
                    Age {child.age} · {child.goalsCount} Active Goals · {child.streakDays} Day Streak 🔥
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedChild(child)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-midnight-950 bg-aurora-green hover:opacity-90 transition shadow-glow-sm"
              >
                + Fund Allowance
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-midnight-950 border border-midnight-800">
                <span className="text-slate-500 block">Everyday</span>
                <span className="text-sm font-bold text-white">{formatMoney(child.everydayCents)}</span>
              </div>
              <div className="p-3 rounded-xl bg-midnight-950 border border-midnight-800">
                <span className="text-slate-500 block">Emergency</span>
                <span className="text-sm font-bold text-aurora-electric">{formatMoney(child.emergencyCents)}</span>
              </div>
              <div className="p-3 rounded-xl bg-midnight-950 border border-midnight-800">
                <span className="text-slate-500 block">Goal Savings</span>
                <span className="text-sm font-bold text-aurora-cyan">{formatMoney(child.savingsCents)}</span>
              </div>
            </div>

            <div className="text-2xs text-slate-400 flex justify-between">
              <span>Auto-Split: {child.split.everyday}% / {child.split.emergency}% / {child.split.savings}%</span>
              <span className="text-aurora-green font-semibold">Strict Parent Approval Active</span>
            </div>
          </div>
        ))}
      </div>

      {/* Funding Modal */}
      {selectedChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-midnight-900 p-6 rounded-3xl border border-midnight-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Fund {selectedChild.fullName}'s Wallet</h2>
              <button onClick={() => setSelectedChild(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <p className="text-xs text-slate-400">
              Allowance will be divided across Everyday ({selectedChild.split.everyday}%), Emergency ({selectedChild.split.emergency}%), and Savings ({selectedChild.split.savings}%).
            </p>
            <form onSubmit={handleFundChild} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Allowance Amount</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="50"
                  value={allowanceAmount}
                  onChange={(e) => setAllowanceAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm focus:border-aurora-cyan focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedChild(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isFunding}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-midnight-950 bg-aurora-green hover:opacity-90 disabled:opacity-50"
                >
                  {isFunding ? "Transferring..." : "Disburse Funds →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Child Account Modal */}
      {isAddChildOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-midnight-900 p-6 rounded-3xl border border-midnight-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">+ Create Child Account</h2>
              <button onClick={() => setIsAddChildOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateChild} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Child Name</label>
                <input
                  type="text"
                  required
                  placeholder="Maya Jenkins"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Child Email</label>
                <input
                  type="email"
                  required
                  placeholder="maya@demo.com"
                  value={childEmail}
                  onChange={(e) => setChildEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={childPassword}
                    onChange={(e) => setChildPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Age</label>
                  <input
                    type="number"
                    min={6}
                    max={17}
                    required
                    value={childAge}
                    onChange={(e) => setChildAge(parseInt(e.target.value, 10) || 10)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddChildOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingChild}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-midnight-950 bg-aurora-green hover:opacity-90 disabled:opacity-50"
                >
                  {isCreatingChild ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
