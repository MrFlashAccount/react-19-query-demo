import anchors from "@toolwind/anchors";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./movies-db/index.html",
    "./monitoring-dashboard/index.html",
    "./examples/movies-db/src/**/*.{js,ts,jsx,tsx}",
    "./examples/monitoring-dashboard/src/**/*.{js,ts,jsx,tsx}",
  ],
  plugins: [anchors],
  darkMode: "class",
  future: "all",
  theme: {
    extend: {
      // Keep monitoring-dashboard custom tokens available when built from repo root.
      colors: {
        slate: {
          850: "#1a1f2e",
          900: "#0f1219",
          950: "#080a0f",
        },
        accent: {
          cyan: "#22d3ee",
          emerald: "#34d399",
          amber: "#fbbf24",
          rose: "#fb7185",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Geist", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
      },
      keyframes: {
        slideInRight: {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
    },
  },
};
