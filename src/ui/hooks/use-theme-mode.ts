import * as React from "react";

const THEME_STORAGE_KEY = "vic-viewer-theme";

export type ThemeMode = "light" | "dark";
export type ShikiThemeId = "github-light" | "github-dark";

export const SHIKI_THEME_IDS: Record<ThemeMode, ShikiThemeId> = {
  light: "github-light",
  dark: "github-dark",
};

type ThemeModeContextValue = {
  theme: ThemeMode;
  toggleTheme: () => void;
  shikiThemes: {
    light: ShikiThemeId;
    dark: ShikiThemeId;
  };
};

const ThemeModeContext = React.createContext<ThemeModeContextValue | null>(null);

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeModeProvider(props: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<ThemeMode>(() => getInitialTheme());

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = React.useCallback(() => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }, []);

  const value = React.useMemo<ThemeModeContextValue>(
    () => ({
      theme,
      toggleTheme,
      shikiThemes: SHIKI_THEME_IDS,
    }),
    [theme, toggleTheme],
  );

  return React.createElement(ThemeModeContext.Provider, { value }, props.children);
}

export function useThemeMode() {
  const context = React.useContext(ThemeModeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within ThemeModeProvider");
  }

  return context;
}
