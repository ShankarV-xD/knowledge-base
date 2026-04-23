import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          dark: "#0f0f0f",
          light: "#fafafa",
        },
        sidebar: {
          dark: "#171717",
          light: "#f5f5f5",
        },
        surface: {
          dark: "#1c1c1c",
          light: "#ffffff",
        },
        border: {
          dark: "#2a2a2a",
          light: "#e5e5e5",
        },
        primary: {
          dark: "#f0f0f0",
          light: "#111111",
        },
        secondary: "#888888",
        accent: "#7c6af7",
        success: "#4ade80",
        error: "#f87171",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
