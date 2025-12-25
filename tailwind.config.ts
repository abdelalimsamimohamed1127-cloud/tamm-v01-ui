import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
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
        sans: ["IBM Plex Sans", "IBM Plex Sans Arabic", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))", // Subtle, soft border
        input: "hsl(var(--input))",   // Input field borders
        ring: "hsl(var(--ring))",     // Focus ring, soft
        
        // --- Core Neutrals ---
        background: "hsl(var(--background))", // Main app background, soft warm-neutral
        foreground: "hsl(var(--foreground))", // Default text, darker soft grey
        
        card: {
          DEFAULT: "hsl(var(--card))", // Card background, slightly lighter than main background
          foreground: "hsl(var(--card-foreground))", // Card text
        },
        popover: {
          DEFAULT: "hsl(var(--popover))", // Popover background
          foreground: "hsl(var(--popover-foreground))", // Popover text
        },

        // --- Primary Action ---
        primary: {
          DEFAULT: "hsl(var(--primary))", // Confident enterprise blue
          foreground: "hsl(var(--primary-foreground))", // Text on primary
        },

        // --- Secondary UI Elements & Muted States ---
        secondary: {
          DEFAULT: "hsl(var(--secondary))", // For secondary buttons, subtle backgrounds
          foreground: "hsl(var(--secondary-foreground))", // Text on secondary
        },
        muted: {
          DEFAULT: "hsl(var(--muted))", // For secondary text, disabled states, light fills
          foreground: "hsl(var(--muted-foreground))", // Text on muted backgrounds
        },
        accent: {
          DEFAULT: "hsl(var(--accent))", // For hover states, subtle highlights
          foreground: "hsl(var(--accent-foreground))", // Text on accent
        },

        // --- Semantic Colors (Muted) ---
        destructive: {
          DEFAULT: "hsl(var(--destructive))", // Muted red for errors
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: "hsl(var(--success))",   // Soft green
        warning: "hsl(var(--warning))",   // Low saturation amber/yellow
        info: "hsl(var(--info))",         // Existing info color

        // --- Sidebar Specifics ---
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))", // Slightly different from main background
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))", // For active sidebar items
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },

        // --- Channel colors (Preserved) ---
        whatsapp: "hsl(var(--whatsapp))",
        instagram: "hsl(var(--instagram))",
        facebook: "hsl(var(--facebook))",
        tiktok: "hsl(var(--tiktok))",
        webchat: "hsl(var(--webchat))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        glow: "var(--shadow-glow)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
