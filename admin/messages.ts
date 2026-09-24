import type { AdminResult } from './admin-api';

// One wording for every failed call on the page (FR-013).
export function failureMessage(result: Exclude<AdminResult<unknown>, { status: 'ok' }>): string {
  switch (result.status) {
    case 'invalid':
      return result.error;
    case 'forbidden':
      return 'Session expirée ou accès refusé : rechargez la page pour vous reconnecter.';
    case 'not-found':
      return 'Ce compteur n\'existe plus : rechargez la page.';
    default:
      return 'Enregistrement impossible pour le moment.';
  }
}

// "157" → 157 ; anything that isn't a plain non-negative integer → NaN, refused by validation.
export function parseCount(text: string): number {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
}
