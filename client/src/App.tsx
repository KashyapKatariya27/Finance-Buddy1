import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Navbar } from "./components/common/Navbar";
import { Footer } from "./components/common/Footer";
import { LandingPage } from "./pages/LandingPage";
import { RegisterPage } from "./pages/RegisterPage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GoalsPage } from "./pages/GoalsPage";
import { EmergencyVaultPage } from "./pages/EmergencyVaultPage";
import { LearningHubPage } from "./pages/LearningHubPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { KidsWalletPage } from "./pages/KidsWalletPage";
import { FamilyManagePage } from "./pages/FamilyManagePage";
import { useStore } from "./store/useStore";

export const App: React.FC = () => {
  const { fetchCurrentUser, user, isLoading } = useStore();

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <div className="min-h-screen flex flex-col bg-midnight-950 text-slate-100 font-sans selection:bg-aurora-electric selection:text-white">
      <Navbar />

      <main className="flex-grow">
        {isLoading ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-aurora-cyan border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <Routes>
            <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/login" replace />} />
            <Route path="/goals" element={user ? <GoalsPage /> : <Navigate to="/login" replace />} />
            <Route path="/emergency" element={user ? <EmergencyVaultPage /> : <Navigate to="/login" replace />} />
            <Route path="/learning" element={user ? <LearningHubPage /> : <Navigate to="/login" replace />} />
            <Route path="/transactions" element={user ? <TransactionsPage /> : <Navigate to="/login" replace />} />
            <Route path="/kids" element={user ? <KidsWalletPage /> : <Navigate to="/login" replace />} />
            <Route path="/kids-wallet" element={<Navigate to="/kids" replace />} />
            <Route path="/family" element={user ? <FamilyManagePage /> : <Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>

      <Footer />
    </div>
  );
};
export default App;
