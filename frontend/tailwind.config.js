/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F5F6F8",
        surface: "#FFFFFF",
        ink: "#171A1F",
        muted: "#69707A",
        line: "#E5E7EB",
        accent: {
          DEFAULT: "#1D4ED8",
          dark: "#1E40AF",
          soft: "#EEF3FF",
        },
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04)",
        panel: "0 12px 32px rgba(16, 24, 40, 0.12)",
      },
      borderRadius: {
        card: "10px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in": {
          from: { transform: "translateX(24px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "slide-in": "slide-in 220ms ease-out",
      },
    },
  },
  plugins: [],
};
