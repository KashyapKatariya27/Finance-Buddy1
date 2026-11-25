/**
 * Midnight Aurora Design Tokens
 * Deep oceanic midnight base with luminous neon aurora gradients and glass effects.
 */

export const tokens = {
  colors: {
    midnight: {
      950: "#070913", // deepest abyss background
      900: "#0B0D1B", // card background
      800: "#0F1226", // elevated panel
      700: "#151938", // borders & outlines
      600: "#1F244D", // hover borders
      500: "#2B326B"
    },
    aurora: {
      green: "#00F5A0",   // neon emerald accent (savings, on-track, progress)
      cyan: "#00D9F5",    // luminous cyan (interactive, secondary focus)
      violet: "#7B2CBF",  // deep violet
      purple: "#9D4EDD",  // aurora purple
      electric: "#6C5CE7",// electric indigo (primary buttons, logos)
      pink: "#F72585",    // warm accent for high priority/celebration
      amber: "#FFB703"    // warning, emergency locks, cooling off
    },
    text: {
      primary: "#FFFFFF",
      secondary: "#A5B4FC",
      muted: "#6B7280",
      accent: "#00F5A0"
    }
  },
  gradients: {
    auroraGlow: "linear-gradient(135deg, #00F5A0 0%, #00D9F5 50%, #6C5CE7 100%)",
    auroraViolet: "linear-gradient(135deg, #7B2CBF 0%, #6C5CE7 50%, #00D9F5 100%)",
    auroraCard: "linear-gradient(180deg, rgba(21, 25, 56, 0.7) 0%, rgba(11, 13, 27, 0.9) 100%)",
    auroraButton: "linear-gradient(135deg, #6C5CE7 0%, #7B2CBF 100%)",
    auroraGreenBtn: "linear-gradient(135deg, #00F5A0 0%, #00B876 100%)"
  },
  shadows: {
    glowGreen: "0 0 25px rgba(0, 245, 160, 0.35)",
    glowCyan: "0 0 25px rgba(0, 217, 245, 0.35)",
    glowPurple: "0 0 30px rgba(108, 92, 231, 0.4)",
    cardGlass: "0 8px 32px 0 rgba(0, 0, 0, 0.5)"
  }
} as const;

export type ThemeTokens = typeof tokens;
