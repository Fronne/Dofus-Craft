import { formatRelativeTime } from './time';

// specs/082-auteur-prix-communautaires: « par Pseudo · il y a 2 h » — who entered a community price, and when.
// Without an author (anonymous, older, private profile) only the moment is told.
const JUST_NOW_SECONDS = 60;

export function formatPriceUpdate(date: string, author?: string, now: Date = new Date()): string {
  const ageSeconds = (now.getTime() - new Date(date).getTime()) / 1000;
  const when = ageSeconds >= 0 && ageSeconds < JUST_NOW_SECONDS ? 'il y a quelques instants' : formatRelativeTime(date, now);
  return author ? `par ${author} · ${when}` : when;
}

// The exact date, for the tooltip and the screen readers.
export function formatPriceUpdateTitle(date: string): string {
  return new Date(date).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
}
