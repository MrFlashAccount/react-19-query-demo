import anchors from "@toolwind/anchors";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./examples/movies-db/src/**/*.{js,ts,jsx,tsx}"],
  plugins: [anchors],
  future: "all",
};
