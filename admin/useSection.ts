import { useEffect, useState } from 'react';
import { parseSection, type SectionId } from './dashboard-summary';

// specs/068-admin-dashboard (research.md D2): the open section is the page's anchor, so the browser's
// back button returns to the dashboard and a section's address can be shared. No anchor = dashboard.
export function useSection(): SectionId | undefined {
  const [section, setSection] = useState(() => parseSection(window.location.hash));
  useEffect(() => {
    const onChange = () => setSection(parseSection(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return section;
}
