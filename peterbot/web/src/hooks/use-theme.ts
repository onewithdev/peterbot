import { useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'peterbot-theme';

function getInitialTheme(): Theme {
  // Check localStorage first
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
  }
  // Default to dark mode on first visit
  return 'dark';
}

function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  
  const root = window.document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const initial = getInitialTheme();
    setThemeState(initial);
    applyTheme(initial);
    setIsInitialized(true);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    window.localStorage.setItem(STORAGE_KEY, newTheme);
    applyTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [theme, setTheme]);

  const isDark = theme === 'dark';

  return {
    theme,
    isDark,
    isInitialized,
    setTheme,
    toggleTheme,
  };
}
