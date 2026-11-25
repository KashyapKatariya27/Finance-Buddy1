import React, { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { apiRequest } from "../api";

export const ChoresPage: React.FC = () => {
  const { user, formatMoney } = useStore();
  const [chores, setChores] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create Chore Form (Parent)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  // Submit Chore Form (Child)
  const [submittingChore, setSubmittingChore] = useState<any | null>(null);
  const [submitNote, setSubmitNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest("/api/chores");
      setChores(res.chores || []);

      if (user?.role === "PARENT") {
        const childRes = await apiRequest("/api/children");
        setChildren(childRes.children || []);
        if (childRes.children?.length > 0 && !selectedChildId) {
          setSelectedChildId(String(childRes.children[0].id));
        }
      }
    } catch (e) {
      console.error("Failed to load chores:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.role]);

  const handleCreateChore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChildId) return;
    setIsCreating(true);
    try {
      await apiRequest("/api/chores", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          rewardAmount: parseFloat(rewardAmount),
          childId: parseInt(selectedChildId, 10)
        })
      });
      setTitle("");
      setDescription("");
      setRewardAmount("");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to assign chore");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmitChore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingChore) return;
    try {
      const formData = new FormData();
      formData.append("note", submitNote);
      if (proofFile) {
        formData.append("proof", proofFile);
      }

      const response = await fetch(`/api/chores/${submittingChore.id}/submit`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Submission failed");
      }

      setSubmittingChore(null);
      setSubmitNote("");
      setProofFile(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to submit chore");
    }
  };

  const handleReviewChore = async (choreId: number, decision: "approved" | "rejected") => {
    try {
      await apiRequest(`/api/chores/${choreId}/review`, {
        method: "POST",
        body: JSON.stringify({ decision })
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to review chore");
    }
  };

  if (user?.role === "INDIVIDUAL") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-slate-400 text-sm">Chores and allowance are only active for Family accounts.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="bg-midnight-900/60 p-6 rounded-3xl border border-midnight-800 backdrop-blur-xl">
        <h1 className="text-3xl font-extrabold text-white">Chores & Earned Rewards</h1>
        <p className="text-sm text-slate-400 mt-1">
          {user?.role === "PARENT"
            ? "Assign chores to your children and approve completed tasks to release rewards"
            : "Complete assigned chores and submit proof to earn allowance into your Everyday wallet"}
        </p>
      </div>

      {/* Parent: Create Chore Form */}
      {user?.role === "PARENT" && (
        <div className="p-6 rounded-3xl bg-midnight-900/80 border border-midnight-800 space-y-4">
          <h2 className="text-lg font-bold text-white">+ Assign a New Chore</h2>
          {children.length === 0 ? (
            <p className="text-xs text-slate-400">No child accounts linked yet. Add a child in Family Hub first.</p>
          ) : (
            <form onSubmit={handleCreateChore} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assign To</label>
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-xs"
                >
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Chore Title</label>
                <input
                  type="text"
                  required
                  placeholder="Clean bedroom"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Reward Amount</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="15"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="py-2.5 px-4 rounded-xl text-xs font-bold text-midnight-950 bg-aurora-green hover:opacity-90 disabled:opacity-50"
              >
                {isCreating ? "Assigning..." : "Assign Chore →"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Chores List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Active & Completed Chores</h2>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading chores...</div>
        ) : chores.length === 0 ? (
          <div className="p-8 rounded-3xl bg-midnight-900/60 border border-midnight-800 text-center text-slate-400 text-xs">
            No chores assigned yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {chores.map((chore) => (
              <div key={chore.id} className="p-6 rounded-3xl bg-midnight-900/80 border border-midnight-800 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">{chore.title}</h3>
                    {chore.description && <p className="text-xs text-slate-400 mt-1">{chore.description}</p>}
                  </div>
                  <span className="text-xs font-black text-aurora-green">
                    +{formatMoney(chore.rewardCents)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-midnight-800/80 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-full text-2xs font-bold uppercase ${
                      chore.status === "approved"
                        ? "bg-aurora-green/20 text-aurora-green"
                        : chore.status === "submitted"
                        ? "bg-aurora-cyan/20 text-aurora-cyan"
                        : chore.status === "rejected"
                        ? "bg-aurora-pink/20 text-aurora-pink"
                        : "bg-midnight-950 text-slate-400"
                    }`}
                  >
                    {chore.status}
                  </span>

                  {user?.role === "CHILD" && chore.status === "pending" && (
                    <button
                      onClick={() => setSubmittingChore(chore)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-midnight-950 bg-aurora-cyan hover:opacity-90"
                    >
                      Mark Done →
                    </button>
                  )}

                  {user?.role === "PARENT" && chore.status === "submitted" && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleReviewChore(chore.id, "approved")}
                        className="px-3 py-1 rounded-lg text-xs font-bold text-midnight-950 bg-aurora-green"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReviewChore(chore.id, "rejected")}
                        className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-midnight-800"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Child Submit Chore Modal */}
      {submittingChore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-midnight-900 p-6 rounded-3xl border border-midnight-800 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Submit: "{submittingChore.title}"</h3>
              <button onClick={() => setSubmittingChore(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSubmitChore} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Completion Note</label>
                <textarea
                  rows={2}
                  placeholder="Finished cleaning!"
                  value={submitNote}
                  onChange={(e) => setSubmitNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Optional Photo / PDF Proof (max 5 MB)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  className="text-xs text-slate-400"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSubmittingChore(null)}
                  className="px-4 py-2 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-midnight-950 bg-aurora-green"
                >
                  Submit for Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
