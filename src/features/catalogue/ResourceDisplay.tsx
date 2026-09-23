import { useEffect, useState } from 'react';
import type { Resource } from '../../domain/types';
import { Icon } from '../../components/Icon';

const COPIED_FEEDBACK_MS = 1500;

export function ResourceDisplay({
  resource,
  quantity,
  copyable,
}: {
  resource: Resource;
  quantity?: number;
  // Clicking the name copies it to the clipboard, e.g. to paste it into the in-game HDV search.
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <span className="resource-display">
      {resource.imageUrl ? (
        <img src={resource.imageUrl} alt="" loading="lazy" width="32" height="32" />
      ) : (
        <span className="resource-image-fallback" role="img" aria-label={`Visuel indisponible pour ${resource.name}`}>
          {resource.name.slice(0, 1)}
        </span>
      )}
      <span>
        {copyable ? (
          // A button inside the price line's <label> doesn't focus the price input when clicked.
          <button
            type="button"
            className={`resource-name-copy${copied ? ' is-copied' : ''}`}
            aria-description="Copier le nom"
            onClick={() => {
              void navigator.clipboard?.writeText(resource.name).then(() => setCopied(true), () => undefined);
            }}
          >
            {resource.name}
            <Icon name={copied ? 'check' : 'copy'} size={14} className="resource-name-copy-icon" />
            <span className="resource-name-copied" aria-live="polite">{copied ? 'Copié' : ''}</span>
          </button>
        ) : resource.name}
        {quantity !== undefined && ` × ${quantity}`}
      </span>
    </span>
  );
}
