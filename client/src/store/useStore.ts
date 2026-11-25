import { create } from "zustand";
import { formatMoney } from "@finance-buddy/shared";
import { apiRequest } from "../api";

export interface UserState {
  user: any | null;
  currency: "INR" | "USD";
  isLoading: boolean;
  dashboard: any | null;
  goals: any[];
  setUser: (user: any | null) => void;
  setCurrency: (currency: "INR" | "USD") => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  fetchDashboard: () => Promise<void>;
  fetchGoals: () => Promise<void>;
  logout: () => Promise<void>;
  formatMoney: (cents: number) => string;
}

export const useStore = create<UserState>((set, get) => ({
  user: null,
  currency: "INR",
  isLoading: true,
  dashboard: null,
  goals: [],

  setUser: (user) => {
    set({
      user,
      currency: user?.currency === "USD" ? "USD" : "INR"
    });
  },

  setCurrency: async (newCurrency) => {
    set({ currency: newCurrency });
    try {
      await apiRequest("/api/currency", {
        method: "POST",
        body: JSON.stringify({ currency: newCurrency })
      });
      if (get().user) {
        set({ user: { ...get().user, currency: newCurrency } });
      }
    } catch (e) {
      console.warn("Failed to persist currency change:", e);
    }
  },

  fetchCurrentUser: async () => {
    set({ isLoading: true });
    try {
      const data = await apiRequest("/api/me");
      if (data?.user) {
        set({
          user: data.user,
          currency: data.user.currency === "USD" ? "USD" : "INR",
          isLoading: false
        });
      } else {
        set({ user: null, isLoading: false });
      }
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  fetchDashboard: async () => {
    try {
      const data = await apiRequest("/api/dashboard");
      set({
        dashboard: data,
        goals: data.goals || [],
        user: data.user || get().user,
        currency: data.user?.currency === "USD" ? "USD" : "INR"
      });
    } catch (e) {
      console.error("Failed to load dashboard:", e);
    }
  },

  fetchGoals: async () => {
    try {
      const data = await apiRequest("/api/goals");
      set({ goals: data.goals || [] });
    } catch (e) {
      console.error("Failed to load goals:", e);
    }
  },

  logout: async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    set({ user: null, dashboard: null, goals: [] });
  },

  formatMoney: (cents: number) => {
    return formatMoney(cents, get().currency);
  }
}));
