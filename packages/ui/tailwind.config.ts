import type { Config } from "tailwindcss";

const withOpacity = (variable: string) =>
  `color-mix(in oklab, var(${variable}) calc(<alpha-value> * 100%), transparent)`;

const config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        departure: [
          "var(--font-geist-sans)",
          "Inter",
          "-apple-system",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "Cantarell",
          "Fira Sans",
          "Droid Sans",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      colors: {
        border: withOpacity("--border"),
        input: withOpacity("--input"),
        ring: withOpacity("--ring"),
        background: withOpacity("--background"),
        foreground: withOpacity("--foreground"),
        primary: {
          DEFAULT: withOpacity("--primary"),
          foreground: withOpacity("--primary-foreground"),
        },
        secondary: {
          DEFAULT: withOpacity("--secondary"),
          foreground: withOpacity("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: withOpacity("--destructive"),
          foreground: withOpacity("--destructive-foreground"),
        },
        muted: {
          DEFAULT: withOpacity("--muted"),
          foreground: withOpacity("--muted-foreground"),
        },
        accent: {
          DEFAULT: withOpacity("--accent"),
          foreground: withOpacity("--accent-foreground"),
        },
        popover: {
          DEFAULT: withOpacity("--popover"),
          foreground: withOpacity("--popover-foreground"),
        },
        card: {
          DEFAULT: withOpacity("--card"),
          foreground: withOpacity("--card-foreground"),
        },
        sidebar: {
          DEFAULT: withOpacity("--sidebar"),
          foreground: withOpacity("--sidebar-foreground"),
          primary: withOpacity("--sidebar-primary"),
          "primary-foreground": withOpacity("--sidebar-primary-foreground"),
          accent: withOpacity("--sidebar-accent"),
          "accent-foreground": withOpacity("--sidebar-accent-foreground"),
          border: withOpacity("--sidebar-border"),
          ring: withOpacity("--sidebar-ring"),
        },
        status: {
          success: {
            DEFAULT: withOpacity("--status-success"),
            foreground: withOpacity("--status-success-foreground"),
          },
          warning: {
            DEFAULT: withOpacity("--status-warning"),
            foreground: withOpacity("--status-warning-foreground"),
          },
          error: {
            DEFAULT: withOpacity("--status-error"),
            foreground: withOpacity("--status-error-foreground"),
          },
          info: {
            DEFAULT: withOpacity("--status-info"),
            foreground: withOpacity("--status-info-foreground"),
          },
        },
      },
      borderRadius: {
        sm: "calc(var(--radius) * 0.6)",
        md: "calc(var(--radius) * 0.8)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) * 1.4)",
        "2xl": "calc(var(--radius) * 1.8)",
        "3xl": "calc(var(--radius) * 2.2)",
        "4xl": "calc(var(--radius) * 2.6)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        enter: {
          from: {
            opacity: "0",
            transform: "translateY(10px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        enter: "enter 0.4s ease-out forwards",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    ({
      addUtilities,
    }: {
      addUtilities: (utilities: Record<string, Record<string, string>>) => void;
    }) => {
      addUtilities({
        ".delay-0": { "animation-delay": "0ms" },
        ".delay-100": { "animation-delay": "100ms" },
        ".delay-200": { "animation-delay": "200ms" },
        ".delay-300": { "animation-delay": "300ms" },
        ".delay-400": { "animation-delay": "400ms" },
        ".delay-500": { "animation-delay": "500ms" },
      });
    },
  ],
} satisfies Config;

export default config;
