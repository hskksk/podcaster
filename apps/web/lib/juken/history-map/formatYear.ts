export function formatYear(year: number): string {
  if (year < 0) {
    const abs = Math.abs(year);
    if (abs >= 10000) return `約紀元前${formatBceMyriad(abs)}`;
    return `紀元前${abs}年`;
  }
  return `${year}年`;
}

function formatBceMyriad(abs: number): string {
  const oku = Math.floor(abs / 10000);
  const rest = abs % 10000;
  if (rest === 0) return `${oku}万年前`;
  if (rest % 1000 === 0) return `${oku}万${rest / 1000}千年前`;
  return `${abs}年`;
}