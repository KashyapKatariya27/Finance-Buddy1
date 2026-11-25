import React, { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { apiRequest } from "../api";

export const KidsWalletPage: React.FC = () => {
  const { user, dashboard, fetchDashboard, formatMoney } = useStore();
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiMessages, setAiMessages] = useState<Array<{ sender: "user" | "buddy"; text: string }>>([
    {
      sender: "buddy",
      text: "Hey Leo! 🚀 I'm your Finance Buddy! I help you save for cool toys and protect your coins! What are we working on today?"
    }
  ]);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiChatInput.trim()) return;

    const userText = aiChatInput.trim();
    setAiMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setAiChatInput("");
    setIsSending(true);

    try {
      const res = await apiRequest("/api/ai/suggestion", {
        method: "POST",
        body: JSON.stringify({ query: userText })
      });
      setAiMessages((prev) => [...prev, { sender: "buddy", text: res.advice }]);
    } catch {
      setAiMessages((prev) => [
        ...prev,
        { sender: "buddy", text: "You're doing super! Remember to feed your Piggy Bank every week! 🐷" }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Playful Banner */}
      <div className="bg-gradient-to-r from-aurora-electric/30 via-aurora-cyan/20 to-aurora-green/30 p-8 rounded-3xl border border-aurora-green/40 shadow-glow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <span className="text-3xl">🌟</span>
            <h1 className="text-3xl font-black text-white">Hey {user?.fullName || "Leo"}!</h1>
            <p className="text-sm text-aurora-green font-bold">
              Welcome to your Secret Savings Chest!
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-midnight-950/80 border border-midnight-800 text-center">
            <span className="text-2xs uppercase tracking-wider text-slate-400 font-bold">Spendable Balance</span>
            <div className="text-2xl font-black text-white mt-0.5">
              {formatMoney(dashboard?.balances?.everydayCents || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* 3 Kids Piggy Jars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-midnight-900/80 border border-aurora-green/40 text-center space-y-2">
          <div className="text-4xl">🍦</div>
          <h2 className="text-base font-bold text-white">Everyday Spend</h2>
          <div className="text-2xl font-black text-aurora-green">
            {formatMoney(dashboard?.balances?.everydayCents || 0)}
          </div>
          <p className="text-xs text-slate-400">For ice cream, treats, and stickers!</p>
        </div>

        <div className="p-6 rounded-3xl bg-midnight-900/80 border border-aurora-cyan/40 text-center space-y-2">
          <div className="text-4xl">🚀</div>
          <h2 className="text-base font-bold text-white">Goal Savings</h2>
          <div className="text-2xl font-black text-aurora-cyan">
            {formatMoney(dashboard?.balances?.savingsCents || 0)}
          </div>
          <p className="text-xs text-slate-400">Locked safe for your big dream toys!</p>
        </div>

        <div className="p-6 rounded-3xl bg-midnight-900/80 border border-aurora-electric/40 text-center space-y-2">
          <div className="text-4xl">🛡️</div>
          <h2 className="text-base font-bold text-white">Emergency Shield</h2>
          <div className="text-2xl font-black text-aurora-electric">
            {formatMoney(dashboard?.balances?.emergencyCents || 0)}
          </div>
          <p className="text-xs text-slate-400">Untouchable shield protecting you!</p>
        </div>
      </div>

      {/* AI Buddy Chat */}
      <div className="p-6 rounded-3xl bg-midnight-900/80 border border-midnight-800 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <span>🤖 Chat with your AI Buddy</span>
        </h2>

        <div className="h-64 overflow-y-auto space-y-3 p-4 rounded-2xl bg-midnight-950 border border-midnight-800">
          {aiMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-md p-3 rounded-2xl text-xs leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-aurora-cyan text-midnight-950 font-bold"
                    : "bg-midnight-900 border border-midnight-850 text-slate-200"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="text-2xs text-slate-400 italic">Buddy is thinking... 💭</div>
          )}
        </div>

        <form onSubmit={handleSendChat} className="flex space-x-2">
          <input
            type="text"
            placeholder="Ask your Buddy anything about saving money!"
            value={aiChatInput}
            onChange={(e) => setAiChatInput(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-midnight-950 border border-midnight-800 text-white text-xs focus:border-aurora-cyan focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSending}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-midnight-950 bg-aurora-green hover:opacity-90 disabled:opacity-50"
          >
            Send 🚀
          </button>
        </form>
      </div>
    </div>
  );
};
