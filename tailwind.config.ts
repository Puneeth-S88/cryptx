import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Strict Theme: Grey, White, Blue, Black Only
        surface: {
          dark: "#0B0D10",       // Primary dark background
          card: "#14171C",       // Secondary surface
          border: "#1E2229",     // Subtle 1px borders
          hover: "#1E232B",      // Hover surface
          inset: "#0D0F13",      // Pressed/input inset surface
          elevated: "#181C22",   // Raised neomorphic element
        },
        accent: {
          blue: "#2563EB",       // Official Blue accent
          hover: "#3B82F6",      // Light Blue hover/focus
          glow: "rgba(37, 99, 235, 0.35)",
          dim: "rgba(37, 99, 235, 0.15)",
        },
        typography: {
          white: "#FFFFFF",
          muted: "#9CA3AF",
          dim: "#6B7280",
          light: "#E5E7EB",
        }
      },
      boxShadow: {
        // Neomorphic Dark Shadows
        'neo-flat': '5px 5px 12px #060709, -5px -5px 12px #1c2129',
        'neo-card': '8px 8px 18px #050608, -8px -8px 18px #1d222b',
        'neo-btn': '4px 4px 10px #060709, -4px -4px 10px #1b2028',
        'neo-inset': 'inset 3px 3px 7px #060709, inset -3px -3px 7px #1c2129',
        'neo-blue': '0 0 20px rgba(37, 99, 235, 0.4), 4px 4px 12px #060709',
        'neo-blue-sm': '0 0 10px rgba(37, 99, 235, 0.3)',
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2.5s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(37, 99, 235, 0.2)" },
          "100%": { boxShadow: "0 0 20px rgba(37, 99, 235, 0.6)" },
        }
      }
    },
  },
  plugins: [],
};
export default config;
