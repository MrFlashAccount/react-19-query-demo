import anchors from "@toolwind/anchors";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  plugins: [anchors],
  future: "all",
};

