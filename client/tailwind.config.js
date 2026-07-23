/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f1420",
        panel: "#171e2e",
        edge: "#26314a",
        amber: { DEFAULT: "#d9a54f", dark: "#b6853a" },
        cream: "#efece7",
        muted: "#8b95ab",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
