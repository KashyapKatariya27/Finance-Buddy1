import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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
import { ChoresPage } from "./pages/ChoresPage";

export const AppRoutes: React.FC<{ user: any }> = ({ user }) => {
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/login" replace />} />
      <Route path="/goals" element={user ? <GoalsPage /> : <Navigate to="/login" replace />} />
      <Route path="/emergency" element={user ? <EmergencyVaultPage /> : <Navigate to="/login" replace />} />
      <Route path="/learning" element={user ? <LearningHubPage /> : <Navigate to="/login" replace />} />
      <Route path="/transactions" element={user ? <TransactionsPage /> : <Navigate to="/login" replace />} />
      <Route path="/chores" element={user ? <ChoresPage /> : <Navigate to="/login" replace />} />
      <Route path="/kids" element={user ? <KidsWalletPage /> : <Navigate to="/login" replace />} />
      <Route path="/kids-wallet" element={<Navigate to="/kids" replace />} />
      <Route path="/family" element={user ? <FamilyManagePage /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
