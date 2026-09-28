import { useEffect, useState } from 'react';
import { Icon } from './Icon';

// Shown once the player has scrolled down a screen or so: one click back to the top of the page.
// Shared by the long, scrolling lists (Rentabilité, specs/019; XP Familier, specs/022 FR-007).
export function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      type="button"
      className="back-to-top"
      aria-label="Revenir en haut"
      title="Revenir en haut"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <Icon name="chevron-down" size={20} />
    </button>
  );
}
