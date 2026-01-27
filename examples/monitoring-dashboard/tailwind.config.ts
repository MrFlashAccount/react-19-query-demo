/** @file Configuration for Tailwind. */
import animate from "tailwindcss-animate";
import anchors from "@toolwind/anchors";

import reactAriaComponents from "tailwindcss-react-aria-components";
import plugin, { type Config } from "tailwindcss/plugin.js";

// The names come from a third-party API and cannot be changed.
const config: Config = {
  theme: {
    extend: {
      cursor: {
        unset: "unset",
      },
      colors: {
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        accent: "var(--color-accent)",
        "accent-dark": "var(--color-accent-dark)",
        tertiary: "var(--color-tertiary)",
        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
        success: "var(--color-success)",
        info: "var(--color-info)",
        white: "var(--color-white)",
        black: "var(--color-black)",
        border: "var(--color-border)",
        invert: "var(--color-invert)",
        background: "var(--color-background)",
        disabled: "var(--color-disabled)",
        "hover-bg": "var(--color-hover-bg)",
        frame: "var(--color-frame)",
        dashboard: "var(--color-dashboard)",
        invite: "var(--color-info)",
        green: "var(--color-success)",
      },
      fontFamily: {
        sans: ["Geist", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": "10.5px",
        xs: "11.5px",
        sm: "13px",
        xl: "19px",
        "3xl": "32px",
        "4xl": "38px",
      },
      borderRadius: {
        inherit: "inherit",
        "2.5xl": "1.25rem",
        "4xl": "2rem",
      },
      spacing: {
        DEFAULT: "0",
        "indent-1": "var(--indent-1-size)",
        "indent-2": "var(--indent-2-size)",
        "indent-3": "var(--indent-3-size)",
        "indent-4": "var(--indent-4-size)",
        "indent-5": "var(--indent-5-size)",
        "indent-6": "var(--indent-6-size)",
        "indent-7": "var(--indent-7-size)",
        "indent-8": "var(--indent-8-size)",
        "indent-9": "var(--indent-9-size)",
        "indent-10": "var(--indent-10-size)",
      },
      width: {
        container: "100cqw",
      },
      minWidth: ({ theme }) => ({ ...theme("width") }),
      maxWidth: ({ theme }) => ({ ...theme("width") }),
      height: {},
      minHeight: ({ theme }) => ({ ...theme("height") }),
      maxHeight: ({ theme }) => ({ ...theme("height") }),
      opacity: {
        full: "100%",
      },
      backdropBlur: {
        xs: "2px",
      },
      borderWidth: {
        0.5: "0.5px",
      },
      boxShadow: {
        soft: `0 0.5px 2.2px 0px #00000008, 0 1.2px 5.3px 0px #0000000b, \
0 2.3px 10px 0 #0000000e, 0 4px 18px 0 #00000011, 0 7.5px 33.4px 0 #00000014, \
0 18px 80px 0 #0000001c`,
        softer: `0 0.5px 2.2px 0px rgb(0 0 0 / 0.84%), 0 1.2px 5.65px 0px rgb(0 0 0 / 1.21%), \
0 2.25px 10.64px 0 rgb(0 0 0 / 1.5%), 0 4px 19px 0 rgb(0 0 0 / 1.79%), 0 7.5px 35.5px 0 rgb(0 0 0 / 2.16%), \
0 18px 85px 0 rgb(0 0 0 / 3%)`,
        "inset-t-lg": `inset 0 1px 1.4px -1.4px #00000002, \
inset 0 2.4px 3.4px -3.4px #00000003, inset 0 4.5px 6.4px -6.4px #00000004, \
inset 0 8px 11.4px -11.4px #00000005, inset 0 15px 21.3px -21.3px #00000006, \
inset 0 36px 51px -51px #00000014`,
        "inset-b-lg": `inset 0 -1px 1.4px -1.4px #00000002, \
inset 0 -2.4px 3.4px -3.4px #00000003, inset 0 -4.5px 6.4px -6.4px #00000004, \
inset 0 -8px 11.4px -11.4px #00000005, inset 0 -15px 21.3px -21.3px #00000006, \
inset 0 -36px 51px -51px #00000014`,
        "inset-v-lg": `inset 0 1px 1.4px -1.4px #00000002, \
inset 0 2.4px 3.4px -3.4px #00000003, inset 0 4.5px 6.4px -6.4px #00000004, \
inset 0 8px 11.4px -11.4px #00000005, inset 0 15px 21.3px -21.3px #00000006, \
inset 0 36px 51px -51px #00000014, inset 0 -1px 1.4px -1.4px #00000002, \
inset 0 -2.4px 3.4px -3.4px #00000003, inset 0 -4.5px 6.4px -6.4px #00000004, \
inset 0 -8px 11.4px -11.4px #00000005, inset 0 -15px 21.3px -21.3px #00000006, \
inset 0 -36px 51px -51px #00000014`,
      },
      animation: {
        "caret-blink": "caret-blink 1.5s ease-out infinite",
        "spin-ease": "spin cubic-bezier(0.67, 0.33, 0.33, 0.67) 1.5s infinite",
        "appear-delayed": "appear-delayed 0.5s ease-in-out",
      },
      transitionProperty: {
        width: "width",
        "min-width": "min-width",
        "stroke-dasharray": "stroke-dasharray",
        "grid-template-rows": "grid-template-rows",
        "border-margin": "border, margin",
      },
      transitionDuration: {
        DEFAULT: "100ms",
        "spinner-fast": "var(--spinner-fast-transition-duration)",
        "spinner-medium": "var(--spinner-medium-transition-duration)",
        "spinner-slow": "var(--spinner-slow-transition-duration)",
      },
      gridTemplateRows: {
        "0fr": "0fr",
        "1fr": "1fr",
      },
      gridTemplateColumns: {
        "0fr": "0fr",
        "1fr": "1fr",
      },
      dashArray: {
        5: "5-12",
        75: "75-12",
        100: "100-12",
      },
      keyframes: {
        "appear-delayed": {
          "0%": { opacity: "0" },
          "99%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [
    reactAriaComponents,
    animate,
    anchors,
    // oxlint-disable-next-line typescript/unbound-method
    plugin(({ addVariant, addUtilities, matchUtilities, theme }) => {
      addUtilities(
        {
          ".pointer-events-none-recursive": {
            pointerEvents: "none",
            "*": { pointerEvents: "none" },
          },
          ".scroll-hidden": {
            MsOverflowStyle: "none" /* Internet Explorer 10+ */,
            scrollbarWidth: "none" /* Firefox */,
            "&::-webkit-scrollbar": {
              display: "none" /* Safari and Chrome */,
            },
          },

          // === States ===

          ".focus-ring, .focus-ring:focus": {
            "@apply outline outline-2 -outline-offset-2 outline-primary transition-all": "",
          },
          ".focus-ring.checkbox": {
            "@apply outline-offset-0": "",
          },

          // === Classes affecting opacity ===

          ".selectable": {
            "@apply disabled:opacity-30 [&.disabled]:opacity-30 disabled:cursor-not-allowed [&.disabled]:cursor-not-allowed opacity-50 hover:opacity-75 transition-all":
              "",
          },

          ".scroll-offset-edge-m": {
            "--scrollbar-offset-edge": "4px",
          },
          ".scroll-offset-edge-xl": {
            "--scrollbar-offset-edge": "8px",
          },
          ".scroll-offset-edge-2xl": {
            "--scrollbar-offset-edge": "16px",
          },
          ".scroll-offset-edge-3xl": {
            "--scrollbar-offset-edge": "24px",
          },
          ".scroll-offset-edge-4xl": {
            "--scrollbar-offset-edge": "28px",
          },

          // === Visbility classes ===

          ".visibility-visible": {},
          ".visibility-hidden": {
            "@apply hidden": "",
          },
          ".visibility-faded": {
            "@apply opacity-50 pointer-events-none-recursive": "",
          },
        },
        {
          respectPrefix: true,
          respectImportant: true,
        },
      );

      /** One revolution, in radians. */
      const revolution = Math.PI * 2;
      matchUtilities(
        {
          // Values must be pre-computed, because FF does not support `calc()` in `stroke-dasharray`.
          // calc(12 * 0.05 * 6.2832) calc(12 * 6.2832)
          dasharray: (value) => {
            const [percentage = 0, radius = 0] = value.split("-").map((part) => Number(part) || 0);
            return {
              strokeDasharray: `${radius * (percentage / 100) * revolution} ${
                percentage === 1 ? 0 : radius * revolution
              }`,
            };
          },
        },
        {
          values: theme("dashArray", {}),
        },
      );

      addVariant("not-focus", "&:where([data-rac]):not([data-focused])");
      addVariant("not-selected", "&:where([data-rac]):not([data-selected])");

      addVariant("macos", ".macos &");
    }),
  ],
};

export default config;
