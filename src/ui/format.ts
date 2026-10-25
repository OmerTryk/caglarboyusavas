export function fmt(n: number): string {
  const v = Math.floor(n);
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e4) return `${(v / 1e3).toFixed(v >= 1e5 ? 0 : 1)}B`;
  return v.toLocaleString('tr-TR');
}

export function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Turkish dative for an age name: "Taş Çağı" → "Taş Çağı'na", "Orta Çağ" → "Orta Çağ'a". */
export function toAge(name: string): string {
  return name.endsWith('ı') ? `${name}'na` : `${name}'a`;
}
