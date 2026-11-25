import type { Config } from "tailwindcss";
import { tokens } from "./src/theme/tokens";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: tokens.colors.midnight,
        aurora: tokens.colors.aurora,
      },
      backgroundImage: {
        "aurora-glow": tokens.gradients.auroraGlow,
        "aurora-violet": tokens.gradients.auroraViolet,
        "aurora-card": tokens.gradients.auroraCard,
        "aurora-btn": tokens.gradients.auroraButton,
        "aurora-green-btn": tokens.gradients.auroraGreenBtn,
      },
      boxShadow: {
        "glow-green": tokens.shadows.glowGreen,
        "glow-cyan": tokens.shadows.glowCyan,
        "glow-purple": tokens.shadows.glowPurple,
        "card-glass": tokens.shadows.cardGlass,
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        }
      }
    },
  },
  plugins: [],
} satisfies Config;
