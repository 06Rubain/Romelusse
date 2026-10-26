const COLORS = ['#0e7c8c', '#7c3aed', '#d95926', '#1baf7a', '#2a78d6', '#c2416b', '#b7791f'];

const initials = (name: string) => {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
};

// Photo de profil, ou initiales sur une couleur propre à la personne
export default function Avatar({ name, photo, size = 36 }: { name: string; photo?: string; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (photo) return <img className="user-avatar" src={photo} alt="" style={style} />;
  const color = COLORS[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % COLORS.length];
  return <span className="user-avatar" style={{ ...style, background: color }} aria-hidden="true">{initials(name)}</span>;
}
