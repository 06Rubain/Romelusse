import type { CSSProperties } from 'react';
import type { Company } from './types';

type Brand = Pick<Company, 'primaryColor' | 'secondaryColor' | 'accentColor' | 'footerImage'> | null | undefined;

const DEFAULTS = { primary: '#009eb5', secondary: '#e28882', accent: '#c92a2a' };

// Éclaircit une couleur #RRGGBB (reflet des étiquettes « FACTURE N° »)
export const brighten = (hex: string, factor = 1.2) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const channel = (shift: number) => Math.min(255, Math.round(((n >> shift) & 255) * factor + 18)).toString(16).padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
};

export const brandColors = (brand: Brand) => ({
  primary: brand?.primaryColor || DEFAULTS.primary,
  secondary: brand?.secondaryColor || DEFAULTS.secondary,
  accent: brand?.accentColor || DEFAULTS.accent,
});

// Fond de l'en-tête : le bandeau de l'entreprise s'il existe (dégradé officiel), sinon ses deux couleurs
export const headerBackground = (brand: Brand): CSSProperties => {
  const { primary, secondary } = brandColors(brand);
  return brand?.footerImage
    ? { backgroundImage: `url(${brand.footerImage})`, backgroundSize: '100% 100%', backgroundColor: primary }
    : { background: `linear-gradient(to right, ${primary} 40%, ${secondary} 100%)` };
};

// Étiquette « FACTURE N° » : couleur d'accent avec reflet, comme sur la charte imprimée
export const labelBackground = (brand: Brand) => {
  const { accent } = brandColors(brand);
  return `linear-gradient(100deg, ${accent} 0%, ${accent} 48%, ${brighten(accent)} 100%)`;
};

// Fond sur lequel afficher le logo dans l'application : le même que l'en-tête des factures,
// pour qu'un logo blanc ou transparent reste lisible
export const logoBackground = headerBackground;
