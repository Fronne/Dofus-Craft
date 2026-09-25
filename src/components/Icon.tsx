export type IconName =
  | 'search'
  | 'bookmark'
  | 'bookmark-filled'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'palette'
  | 'users'
  | 'chevron-down'
  | 'close'
  | 'check'
  | 'server'
  | 'grid'
  | 'home'
  | 'coins'
  | 'trending-up'
  | 'trending-down'
  | 'info'
  | 'level'
  | 'package'
  | 'edit'
  | 'copy'
  | 'chart';

const paths: Record<IconName, { filled?: boolean; children: string }> = {
  search: {
    children:
      '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  },
  bookmark: {
    children: '<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z"/>',
  },
  'bookmark-filled': {
    filled: true,
    children: '<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z"/>',
  },
  settings: {
    children:
      '<line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2"/>' +
      '<line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2"/>' +
      '<line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="18" r="2"/>',
  },
  sun: {
    children:
      '<circle cx="12" cy="12" r="4"/>' +
      '<line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/>' +
      '<line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/>' +
      '<line x1="4.9" y1="4.9" x2="6.6" y2="6.6"/><line x1="17.4" y1="17.4" x2="19.1" y2="19.1"/>' +
      '<line x1="4.9" y1="19.1" x2="6.6" y2="17.4"/><line x1="17.4" y1="6.6" x2="19.1" y2="4.9"/>',
  },
  moon: {
    children: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  },
  palette: {
    children:
      '<circle cx="12" cy="12" r="9"/>' +
      '<circle cx="8.6" cy="10.4" r="1.15" fill="currentColor" stroke="none"/>' +
      '<circle cx="12" cy="7.4" r="1.15" fill="currentColor" stroke="none"/>' +
      '<circle cx="15.4" cy="10.4" r="1.15" fill="currentColor" stroke="none"/>' +
      '<circle cx="12" cy="15.2" r="1.15" fill="currentColor" stroke="none"/>',
  },
  users: {
    children:
      '<circle cx="8.2" cy="9" r="3"/><path d="M2.5 19.8c0-3.3 2.55-6 5.7-6s5.7 2.7 5.7 6"/>' +
      '<circle cx="17" cy="9" r="2.4"/><path d="M14.6 14.1c2.5.4 4.4 2.7 4.4 5.7"/>',
  },
  'chevron-down': { children: '<polyline points="6 9 12 15 18 9"/>' },
  close: { children: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>' },
  check: { children: '<polyline points="5 13 9.5 17.5 19 7"/>' },
  server: {
    children:
      '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/>' +
      '<circle cx="7" cy="7" r=".8" fill="currentColor" stroke="none"/>' +
      '<circle cx="7" cy="17" r=".8" fill="currentColor" stroke="none"/>',
  },
  grid: {
    children:
      '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/>' +
      '<rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  },
  home: {
    children: '<path d="M4 11.2 12 4l8 7.2"/><path d="M6 9.6V20h12V9.6"/><path d="M10 20v-6h4v6"/>',
  },
  coins: {
    children:
      '<ellipse cx="9" cy="7" rx="6" ry="3.2"/><path d="M3 7v5c0 1.77 2.69 3.2 6 3.2s6-1.43 6-3.2V7"/>' +
      '<path d="M9 12.2v5c0 1.77 2.69 3.2 6 3.2s6-1.43 6-3.2v-5"/>' +
      '<ellipse cx="15" cy="12.2" rx="6" ry="3.2"/>',
  },
  // specs/017: price history — a small rising curve on its axes.
  chart: {
    children: '<polyline points="4 4 4 20 20 20"/><polyline points="7 15 11 11 14 13 19 7"/>',
  },
  'trending-up': {
    children: '<polyline points="3 17 10 10 14 14 21 6"/><polyline points="15 6 21 6 21 12"/>',
  },
  'trending-down': {
    children: '<polyline points="3 7 10 14 14 10 21 18"/><polyline points="15 18 21 18 21 12"/>',
  },
  info: {
    children:
      '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16.5"/>' +
      '<circle cx="12" cy="7.6" r=".9" fill="currentColor" stroke="none"/>',
  },
  level: {
    children: '<polyline points="4 16 12 8 20 16"/>',
  },
  package: {
    children:
      '<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="M4 7l8 4 8-4"/><line x1="12" y1="11" x2="12" y2="21"/>',
  },
  edit: {
    children:
      '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  },
  copy: {
    children:
      '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  },
};

export function Icon({
  name,
  size = 18,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const spec = paths[name];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={spec.filled ? 'currentColor' : 'none'}
      stroke={spec.filled ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: spec.children }}
    />
  );
}
