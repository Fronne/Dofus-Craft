import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { isInfoMessageActive, type InfoMessage } from '../domain/info-message';
import { getInfoMessage } from '../services/info-message-api';
import { dismissVersion, readDismissedVersion } from '../persistence/info-banner-dismissal';

// specs/020-info-banner (contracts/info-banner-ui.md): the owner's information message, above every
// page. Loaded without holding up the rest of the site, and again on a page change once the last load
// is 5 minutes old; any failure simply shows nothing (FR-008). The text is rendered as plain text.
const REFRESH_AFTER_MS = 5 * 60 * 1000;

export function InfoBanner() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState<InfoMessage>();
  const [dismissed, setDismissed] = useState(readDismissedVersion);
  const [now, setNow] = useState(() => Date.now());
  const loadedAt = useRef(0);

  useEffect(() => {
    if (loadedAt.current && Date.now() - loadedAt.current < REFRESH_AFTER_MS) return;
    const startedAt = Date.now();
    loadedAt.current = startedAt;
    let cancelled = false;
    let finished = false;
    void getInfoMessage().then((next) => {
      if (cancelled) return;
      finished = true;
      setMessage(next);
      setNow(Date.now());
    });
    return () => {
      cancelled = true;
      // A load cancelled before it could show anything doesn't count as done (e.g. React's
      // development double mount), so the next run fetches again instead of skipping.
      if (!finished && loadedAt.current === startedAt) loadedAt.current = 0;
    };
  }, [pathname]);

  // FR-006: a page left open hides the banner when its end date comes.
  const endsAt = message?.endsAt ? Date.parse(message.endsAt) : undefined;
  useEffect(() => {
    if (endsAt === undefined || endsAt <= now) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(endsAt - now, 2 ** 31 - 1));
    return () => window.clearTimeout(timer);
  }, [endsAt, now]);

  if (!message || message.version === dismissed || !isInfoMessageActive(message, new Date(now))) return null;

  const important = message.tone === 'important';
  return (
    <div className={`info-banner info-banner--${message.tone}`} role={important ? 'alert' : 'status'}>
      <Icon name="info" size={18} className="info-banner-icon" />
      <p className="info-banner-text">{message.text}</p>
      <button
        type="button"
        className="icon-button info-banner-close"
        aria-label="Fermer le message"
        onClick={() => {
          dismissVersion(message.version);
          setDismissed(message.version);
        }}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
