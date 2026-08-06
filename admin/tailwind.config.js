/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: "#02A694",
          dark: "#028A7B",
          light: "#E4F5F2",
        },
        blue: {
          DEFAULT: "#1FAFE8",
          dark: "#1690C2",
          light: "#E7F6FD",
        },
        ink: {
          DEFAULT: "#14201F",
          soft: "#5B6B69",
        },
        bg: "#F5F8F7",
        border: "#E1E8E7",
        amber: {
          DEFAULT: "#E8A33D",
          light: "#FCF1DE",
        },
        red: {
          DEFAULT: "#D6483F",
          light: "#FBE9E7",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        sans: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 32, 31, 0.04), 0 1px 12px rgba(20, 32, 31, 0.05)",
      },
    },
  },
  plugins: [],
};
