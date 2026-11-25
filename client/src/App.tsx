import React, { useEffect } from "react";
import { Navbar } from "./components/common/Navbar";
import { Footer } from "./components/common/Footer";
import { AppRoutes } from "./routes";
import { useStore } from "./store/useStore";
import { ThemeProvider } from "./theme/ThemeProvider";

export const App: React.FC = () => {
  const { fetchCurrentUser, user, isLoading } = useStore();

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col bg-midnight-950 text-slate-100 font-sans selection:bg-aurora-electric selection:text-white">
        <Navbar />

        <main className="flex-grow">
          {isLoading ? (
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-aurora-cyan border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <AppRoutes user={user} />
          )}
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
};
export default App;
