import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Extracted from the user's actual Claude Design mockup file
      // ("File Uploader - Mobile Mockups.dc.html") rather than guessed.
      colors: {
        sage: {
          50: "#f1f4f0",
          100: "#e3e9e1",
          200: "#c9d3c5",
          300: "#a9b8a2",
          400: "#869880",
          500: "#6d8567",
          600: "#5e7c63",
          700: "#4c6752",
          800: "#3a4f3d",
          900: "#2e3f30",
        },
        sand: {
          50: "#f6f6f3",
          100: "#efefeb",
          200: "#e2e3dd",
          300: "#c9cdc4",
          400: "#a9aea4",
          500: "#8a9086",
          600: "#6b7168",
          700: "#4a4f48",
          800: "#3a3f38",
          900: "#1a1d1a",
          950: "#14160f",
        },
        brick: {
          50: "#fbeded",
          100: "#f0dcd9",
          600: "#c0362c",
          700: "#a62e25",
        },
      },
      fontFamily: {
        sans: [
          "Geist",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,30,26,0.04), 0 12px 28px -22px rgba(28,30,26,0.4)",
        overlay: "0 28px 60px -28px rgba(28,30,26,0.3)",
        sheet: "0 -20px 40px -20px rgba(26,29,26,0.4)",
        button: "0 8px 18px -10px rgba(60,90,66,0.8)",
      },
    },
  },
  plugins: [],
};

export default config;
