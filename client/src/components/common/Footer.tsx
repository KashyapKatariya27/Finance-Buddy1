import React from "react";
import { DISCLAIMER } from "@finance-buddy/shared";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-midnight-800/80 bg-midnight-950/95 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-aurora-electric to-aurora-green flex items-center justify-center">
              <span className="text-midnight-950 font-bold text-xs">₹</span>
            </div>
            <span className="font-semibold text-white tracking-tight">FinanceBuddy</span>
            <span className="text-xs text-slate-500">© {new Date().getFullYear()}</span>
          </div>

          {/* Mandatory Simulated Balance Disclaimer Banner */}
          <div className="max-w-2xl px-4 py-2 rounded-xl bg-midnight-900/90 border border-midnight-700/60 shadow-inner">
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              <span className="text-aurora-electric font-bold mr-1.5">⚡ Note:</span>
              {DISCLAIMER}
            </p>
          </div>

          <div className="text-xs text-slate-400 flex items-center space-x-4">
            <span className="hover:text-aurora-cyan cursor-pointer transition">Privacy</span>
            <span className="hover:text-aurora-cyan cursor-pointer transition">Safety Guardrails</span>
            <span className="text-2xs px-2 py-0.5 rounded bg-midnight-800 text-aurora-green border border-aurora-green/20">
              Midnight Aurora
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
