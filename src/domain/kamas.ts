export function normalizeKamasInput(value: string): string {
  return value.replace(/\s/g, '');
}

export function formatKamasInput(value: string): string {
  const normalized = normalizeKamasInput(value);
  if (!/^\d+$/.test(normalized)) return value;
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function parseKamas(value: string): number | undefined {
  const normalized = normalizeKamasInput(value);
  if (normalized === '') return undefined;
  return /^\d+$/.test(normalized) ? Number(normalized) : undefined;
}

export function isValidKamas(value: string) {
  const normalized = normalizeKamasInput(value);
  return normalized === '' || /^\d+$/.test(normalized);
}

export function formatKamas(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value) + ' kamas';
}

export function formatPercent(value?: number) {
  return value === undefined ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value) + ' %';
}
