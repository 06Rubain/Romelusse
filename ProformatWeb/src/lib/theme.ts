import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const readTheme = (): Theme => {
  try {
    return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
};

// Thème clair par défaut ; le choix est mémorisé dans ce navigateur
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem('theme', theme); } catch { /* stockage indisponible */ }
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
}
