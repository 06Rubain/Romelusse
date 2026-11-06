// Mot de passe provisoire lisible (sans 0/O ni 1/l/I), ex. « kT7m-Pq4x-Z9a »
export function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((g) => g.join('')).join('-');
}

export interface Access { email: string; password: string; name?: string; companyName?: string }

export const loginUrl = () => `${window.location.origin}/login`;

export const accessMessage = ({ email, password, name, companyName }: Access) => [
  `Bonjour${name ? ` ${name}` : ''},`,
  `Votre accès à OmniCom Facturation${companyName ? ` pour ${companyName}` : ''} est prêt :`,
  `Adresse : ${loginUrl()}`,
  `E-mail : ${email}`,
  `Mot de passe provisoire : ${password}`,
  'Pensez à le changer dans « Mon profil » après la première connexion.',
].join('\n');

// Couleur dominante (saturée) d'un logo, pour proposer automatiquement la couleur des factures
export async function dominantColor(dataUrl: string): Promise<string | null> {
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = dataUrl;
  });
  if (!img) return null;
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // Ignore la transparence, le blanc, le noir et les gris
    if (a < 200 || max < 50 || min > 225 || max - min < 50) continue;
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const bucket = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    bucket.n += 1; bucket.r += r; bucket.g += g; bucket.b += b;
    buckets.set(key, bucket);
  }
  const best = [...buckets.values()].sort((x, y) => y.n - x.n)[0];
  if (!best || best.n < 8) return null;
  const hex = (v: number) => Math.round(v / best.n).toString(16).padStart(2, '0');
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}
