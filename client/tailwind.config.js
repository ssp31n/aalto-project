/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#4285F4", // Google Blue
        success: "#34A853", // Google Green
        warning: "#FBBC05", // Google Yellow
        danger: "#EA4335", // Google Red
      },
    },
  },
  plugins: [],
};
