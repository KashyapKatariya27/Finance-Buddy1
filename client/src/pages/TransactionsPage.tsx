import React, { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { apiRequest } from "../api";

export const TransactionsPage: React.FC = () => {
  const { formatMoney } = useStore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTx = async () => {
      try {
        const res = await apiRequest("/api/family/transactions");
        setTransactions(res.transactions || []);
      } catch (e) {
        console.error("Failed to load transactions:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadTx();
  }, []);

  const filtered = transactions.filter((tx) => {
    const matchesSearch = tx.note.toLowerCase().includes(search.toLowerCase()) || tx.type.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || tx.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="bg-midnight-900/60 p-6 rounded-3xl border border-midnight-800 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Simulated Financial Ledger</h1>
          <p className="text-sm text-slate-400 mt-1">
            Complete audit trail of deposits, card spends, round-ups, and goal unlocks
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <input
          type="text"
          placeholder="Search by description or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 px-3.5 py-2.5 rounded-xl bg-midnight-900 border border-midnight-800 text-white text-xs focus:border-aurora-cyan focus:outline-none"
        />

        <div className="flex items-center space-x-2 self-end sm:self-auto text-xs">
          <span className="text-slate-500">Filter:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-xl bg-midnight-900 border border-midnight-800 text-white text-xs focus:outline-none"
          >
            <option value="all">All Entries</option>
            <option value="goal_deposit">Goal Deposits</option>
            <option value="card_purchase">Card Purchases</option>
            <option value="round_up_save">Round-Ups</option>
            <option value="initial_deposit">Initial / Bonus</option>
            <option value="learning_reward">Learning Rewards</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-midnight-900/80 rounded-3xl border border-midnight-800 overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading ledger records...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No transaction records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-midnight-950/80 text-slate-400 uppercase tracking-wider text-2xs border-b border-midnight-800">
                <tr>
                  <th className="px-6 py-3.5">Date & Time</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Description</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-midnight-800/60 text-slate-300">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-midnight-850/50 transition">
                    <td className="px-6 py-3.5 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase bg-midnight-950 border border-midnight-800 text-aurora-cyan">
                        {tx.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-white">{tx.note}</td>
                    <td className="px-6 py-3.5 text-right font-bold whitespace-nowrap">
                      <span className={tx.type === "card_purchase" ? "text-aurora-pink" : "text-aurora-green"}>
                        {tx.type === "card_purchase" ? "-" : "+"}
                        {formatMoney(tx.amountCents)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
