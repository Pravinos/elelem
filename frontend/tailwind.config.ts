import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0c0f12",
        panel: "#131922",
        border: "#273244",
        accent: "#28c6b0",
        user: "#2658ff",
      },
    },
  },
  plugins: [],
};

export default config;
