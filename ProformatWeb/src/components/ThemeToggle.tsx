import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme';

export default function ThemeToggle({ className = 'icon-btn' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre';
  return (
    <button type="button" className={className} onClick={toggle} title={label} aria-label={label}>
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
