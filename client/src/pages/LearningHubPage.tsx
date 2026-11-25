import React, { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { apiRequest } from "../api";

export const LearningHubPage: React.FC = () => {
  const { formatMoney } = useStore();
  const [data, setData] = useState<any | null>(null);
  const [activeLevel, setActiveLevel] = useState<"All" | "Kids" | "Teens" | "Adults">("Adults");
  const [activeQuizModule, setActiveQuizModule] = useState<any | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLearning = async () => {
    try {
      const res = await apiRequest("/api/learning");
      setData(res);
      if (res.defaultLevel) {
        setActiveLevel(res.defaultLevel);
      }
    } catch (e) {
      console.error("Failed to load learning hub:", e);
    }
  };

  useEffect(() => {
    fetchLearning();
  }, []);

  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuizModule || selectedAnswer === null) return;
    setIsSubmitting(true);
    setQuizResult(null);

    try {
      const res = await apiRequest("/api/learning/complete", {
        method: "POST",
        body: JSON.stringify({
          moduleId: activeQuizModule.id,
          answerIndex: selectedAnswer
        })
      });
      setQuizResult(res);
      await fetchLearning();
    } catch (err: any) {
      setQuizResult({
        correct: false,
        message: err.message || "Incorrect answer, try again!"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!data) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-aurora-cyan border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading learning modules...</p>
        </div>
      </div>
    );
  }

  const filteredModules =
    activeLevel === "All"
      ? data.modules
      : data.modules.filter((m: any) => m.level === activeLevel);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header with Streak Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-midnight-900/60 p-6 rounded-3xl border border-midnight-800 backdrop-blur-xl">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center space-x-3">
            <span>Financial Learning Hub</span>
            <span className="text-2xs px-2.5 py-1 rounded-full bg-aurora-green/20 text-aurora-green font-bold">
              Level-Aware
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Master money fundamentals at every stage of life, from pocket money to SIP compounding
          </p>
        </div>

        <div className="flex items-center space-x-3 px-4 py-2.5 rounded-2xl bg-midnight-950 border border-midnight-800 shadow-glow-sm">
          <span className="text-2xl animate-bounce">🔥</span>
          <div>
            <div className="text-xs text-slate-400 font-medium">Learning Streak</div>
            <div className="text-base font-black text-aurora-electric">{data.streakDays} Days Strong</div>
          </div>
        </div>
      </div>

      {/* Level Filters */}
      <div className="flex items-center space-x-2 border-b border-midnight-800 pb-4">
        {(["Adults", "Teens", "Kids", "All"] as const).map((lvl) => (
          <button
            key={lvl}
            onClick={() => setActiveLevel(lvl)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeLevel === lvl
                ? "bg-aurora-electric text-midnight-950 shadow-glow-sm"
                : "bg-midnight-900 text-slate-400 hover:text-white hover:bg-midnight-800"
            }`}
          >
            {lvl === "All" ? "View All Levels" : `${lvl} Focus`}
          </button>
        ))}
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModules.map((module: any) => (
          <div
            key={module.id}
            className={`p-6 rounded-3xl border transition shadow-xl flex flex-col justify-between ${
              module.completed
                ? "bg-midnight-900/50 border-aurora-green/40 opacity-90"
                : "bg-midnight-900/80 border-midnight-800 hover:border-aurora-cyan/50"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <span className="text-3xl p-2.5 rounded-2xl bg-midnight-950 border border-midnight-800">
                  {module.icon || "📚"}
                </span>
                <span
                  className={`text-2xs font-bold px-2 py-0.5 rounded-full ${
                    module.level === "Kids"
                      ? "bg-aurora-pink/20 text-aurora-pink"
                      : module.level === "Teens"
                      ? "bg-aurora-cyan/20 text-aurora-cyan"
                      : "bg-aurora-green/20 text-aurora-green"
                  }`}
                >
                  {module.level} · {module.category}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-white text-base leading-snug">{module.title}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{module.summary}</p>
              </div>

              <div className="flex items-center justify-between text-2xs text-slate-500 pt-2 border-t border-midnight-800/80">
                <span>⏱️ {module.durationMinutes} min lesson</span>
                <span className="text-aurora-green font-bold">+{formatMoney(module.rewardCents)} reward</span>
              </div>
            </div>

            <div className="pt-4">
              {module.completed ? (
                <div className="w-full py-2.5 rounded-xl text-center text-xs font-bold text-aurora-green bg-aurora-green/10 border border-aurora-green/30">
                  ✓ Mastered & Claimed
                </div>
              ) : (
                <button
                  onClick={() => {
                    setActiveQuizModule(module);
                    setSelectedAnswer(null);
                    setQuizResult(null);
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-midnight-950 bg-gradient-to-r from-aurora-green to-aurora-cyan hover:opacity-90 transition shadow-glow-sm"
                >
                  Start Challenge & Earn →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quiz Modal */}
      {activeQuizModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-950/80 backdrop-blur-sm p-4">
          <div className="max-w-lg w-full bg-midnight-900 p-6 rounded-3xl border border-midnight-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{activeQuizModule.icon}</span>
                <h3 className="text-base font-bold text-white">{activeQuizModule.title}</h3>
              </div>
              <button onClick={() => setActiveQuizModule(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-4 rounded-2xl bg-midnight-950 border border-midnight-800 text-sm font-semibold text-white">
              {activeQuizModule.quiz.question}
            </div>

            {quizResult && (
              <div
                className={`p-4 rounded-2xl text-xs leading-relaxed ${
                  quizResult.correct
                    ? "bg-aurora-green/15 border border-aurora-green/40 text-aurora-green"
                    : "bg-aurora-pink/15 border border-aurora-pink/40 text-aurora-pink"
                }`}
              >
                <div className="font-bold">{quizResult.message}</div>
                {quizResult.explanation && <div className="mt-1">{quizResult.explanation}</div>}
              </div>
            )}

            <form onSubmit={handleAnswerSubmit} className="space-y-3">
              <div className="space-y-2">
                {activeQuizModule.quiz.options.map((opt: string, idx: number) => (
                  <label
                    key={idx}
                    className={`flex items-center space-x-3 p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                      selectedAnswer === idx
                        ? "bg-midnight-800 border-aurora-cyan text-white shadow-glow-sm"
                        : "bg-midnight-950 border-midnight-800 text-slate-300 hover:bg-midnight-850"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quizOption"
                      checked={selectedAnswer === idx}
                      onChange={() => setSelectedAnswer(idx)}
                      className="text-aurora-cyan focus:ring-0"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveQuizModule(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={selectedAnswer === null || isSubmitting || quizResult?.correct}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-midnight-950 bg-aurora-green hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? "Checking..." : "Submit Answer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
