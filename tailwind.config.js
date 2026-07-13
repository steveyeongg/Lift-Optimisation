/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0d12",
          900: "#0d1219",
          800: "#141a24",
          700: "#1c2532",
          600: "#2a3444",
          500: "#3b475b",
        },
        accent: {
          cyan: "#38e0d6",
          amber: "#f0b429",
          rose: "#ef4d6a",
          lime: "#8fd14f",
          violet: "#8b7cff",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
