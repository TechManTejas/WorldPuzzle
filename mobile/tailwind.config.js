/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        void: "#07080d",
        ink: "#0c0e16",
        mist: "#e2e8f0",
        accent: "#22d3ee",
        accent2: "#a78bfa",
        danger: "#fb7185",
      },
    },
  },
  plugins: [],
};
