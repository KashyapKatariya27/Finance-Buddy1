import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { HeroScene } from "../components/3d/HeroScene";
import { useStore } from "../store/useStore";

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useStore();

  const handleQuickEntry = (mode: "FAMILY" | "TEEN" | "MYSELF") => {
    navigate(`/register?mode=${mode}`);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Background aurora gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-32 left-1/4 w-96 h-96 bg-aurora-electric/15 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-aurora-green/15 rounded-full blur-3xl" />
      </div>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 space-y-6 text-center lg:text-left"
          >
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-midnight-900 border border-aurora-green/30 shadow-glow-sm">
              <span className="w-2 h-2 rounded-full bg-aurora-green animate-pulse" />
              <span className="text-xs font-semibold text-aurora-green">
                Goal-First Financial Platform for Every Stage of Life
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Save for every goal in your life,{" "}
              <span className="bg-gradient-to-r from-aurora-cyan via-aurora-green to-aurora-electric bg-clip-text text-transparent">
                at any age.
              </span>
            </h1>

            <p className="text-lg text-slate-300 max-w-2xl leading-relaxed">
              Whether you're a child saving for your first LEGO set, a student buying a laptop,
              or an adult building an emergency runway and dream vacation — FinanceBuddy turns your aspirations into
              achievable milestones.
            </p>

            {/* 3-Way Entry Selection */}
            <div className="pt-4 space-y-3">
              <p className="text-xs uppercase font-bold tracking-wider text-slate-400">
                Choose how you'll use FinanceBuddy:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleQuickEntry("FAMILY")}
                  className="p-4 rounded-xl bg-midnight-900/90 hover:bg-midnight-800 border border-midnight-700/80 hover:border-aurora-green/50 text-left transition group shadow-sm hover:shadow-glow-sm"
                >
                  <div className="text-2xl mb-1">👨‍👩‍👧‍👦</div>
                  <h2 className="font-bold text-white group-hover:text-aurora-green transition">
                    For Kids & Families
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Parents guide children with supervised goals and approval locks.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickEntry("TEEN")}
                  className="p-4 rounded-xl bg-midnight-900/90 hover:bg-midnight-800 border border-midnight-700/80 hover:border-aurora-cyan/50 text-left transition group shadow-sm hover:shadow-glow-sm"
                >
                  <div className="text-2xl mb-1">🎓</div>
                  <h2 className="font-bold text-white group-hover:text-aurora-cyan transition">
                    For Students
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Self-managed goals with optional accountability partner check-ins.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickEntry("MYSELF")}
                  className="p-4 rounded-xl bg-midnight-900/90 hover:bg-midnight-800 border border-midnight-700/80 hover:border-aurora-electric/50 text-left transition group shadow-sm hover:shadow-glow-sm"
                >
                  <div className="text-2xl mb-1">🚀</div>
                  <h2 className="font-bold text-white group-hover:text-aurora-electric transition">
                    For Everyone
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Full personal independence with self-discipline 24h cooling locks.
                  </p>
                </button>
              </div>
            </div>

            {/* Quick Demo Login CTA */}
            <div className="pt-2 flex flex-wrap items-center gap-3 justify-center lg:justify-start">
              <Link
                to="/login"
                className="px-6 py-3 rounded-xl font-bold text-midnight-950 bg-gradient-to-r from-aurora-green via-aurora-cyan to-aurora-electric shadow-glow hover:opacity-90 transition text-sm"
              >
                Launch Demo Accounts →
              </Link>
              {user && (
                <Link
                  to="/dashboard"
                  className="px-6 py-3 rounded-xl font-semibold text-white bg-midnight-800 hover:bg-midnight-700 border border-midnight-700 transition text-sm"
                >
                  Open My Dashboard
                </Link>
              )}
            </div>
          </motion.div>

          {/* 3D Scene Column */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="lg:col-span-5 flex flex-col items-center"
          >
            <div className="w-full rounded-2xl bg-gradient-to-b from-midnight-900/60 to-midnight-950/80 border border-midnight-800/80 p-2 shadow-2xl backdrop-blur-xl">
              <HeroScene />
              <div className="p-4 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-aurora-cyan">
                  Interactive 3D Goal Core
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Visualize your savings velocity in real time
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-midnight-900">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold text-white">Built Around How You Actually Reach Goals</h2>
          <p className="text-slate-400 mt-3 text-sm">
            Proven behavioral psychology merged with frictionless automation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-midnight-900/60 border border-midnight-800 hover:border-aurora-green/40 transition">
            <div className="w-12 h-12 rounded-xl bg-aurora-green/10 text-aurora-green flex items-center justify-center text-2xl mb-4">
              🎯
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Automated Pacing Calculation</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Every goal computes exact weekly and monthly savings targets, real-time on-track status, and
              milestone celebration badges at 25%, 50%, 75%, and 100%.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-midnight-900/60 border border-midnight-800 hover:border-aurora-electric/40 transition">
            <div className="w-12 h-12 rounded-xl bg-aurora-electric/10 text-aurora-electric flex items-center justify-center text-2xl mb-4">
              🛡️
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Self-Discipline Cooling-Off Lock</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Locked until you reach your target. Early withdrawals require a 24-hour cooling-off countdown
              showing how many days your dream will be delayed, curbing impulse spending.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-midnight-900/60 border border-midnight-800 hover:border-aurora-cyan/40 transition">
            <div className="w-12 h-12 rounded-xl bg-aurora-cyan/10 text-aurora-cyan flex items-center justify-center text-2xl mb-4">
              🌱
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Age-Aware Presets & Runway</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Tailored splits for Kids (6-12), Teens (13-17), Young Adults (18-25), and Adults (26+).
              Includes dedicated Emergency Vault guidance with 3 to 6 months runway coverage.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
