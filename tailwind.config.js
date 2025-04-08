/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/**/*.html"],
  theme: {
    extend: {
      colors: {
        "brand-pink": "#ff82d4",
        "brand-dark-pink": "#472c3d",
      },
      fontFamily: {
        sans: ["Apfel Grotezk", "sans-serif"],
        // sans: ["Inter Variable", "sans-serif"],
        // sans: ["Open Sauce One", "sans-serif"],
        serif: ["Bricolage Grotesque", "serif"],
        mono: ["JetBrains Mono"],
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            maxWidth: "none",
            "pre:has(> code)": {
              borderRadius: "0.75rem",
              borderWidth: "1px",
              borderColor: theme("colors.zinc.800"),
              backgroundColor: theme("colors.black"),
            },
            code: {
              // color: '#a5d6ff',
              fontWeight: "inherit",
              fontSize: "87.5%",
              padding: "0 4px",
              borderRadius: "0.375rem",
              borderWidth: "1px",
              borderColor: theme("colors.zinc.800"),
              backgroundColor: theme("colors.black"),
              "&::before": {
                content: "none !important",
              },
              "&::after": {
                content: "none !important",
              },
            },
          },
        },
        white: {
          css: {
            "--tw-prose-body": "#ececec",
            "--tw-prose-headings": "#ececec",
            "--tw-prose-lead": "#ececec",
            "--tw-prose-links": "#ff82d4",
            "--tw-prose-bold": "#ececec",
            "--tw-prose-counters": "#ececec",
            "--tw-prose-bullets": "#ececec",
            "--tw-prose-hr": "#ececec",
            "--tw-prose-quotes": "#ececec",
            "--tw-prose-quote-borders": "#ececec",
            "--tw-prose-captions": "#ececec",
            "--tw-prose-code": "#ececec",
            "--tw-prose-pre-code": "#ececec",
            "--tw-prose-pre-bg": "#2a2a2a",
            "--tw-prose-th-borders": "#ececec",
            "--tw-prose-td-borders": "#ececec",
            "--tw-prose-kbd": "#676767",
          },
        },
      }),
    },
  },
  plugins: [require("@tailwindcss/typography")],
};