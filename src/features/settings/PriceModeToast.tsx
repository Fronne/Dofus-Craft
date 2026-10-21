import { useEffect, useRef, useState } from 'react';
import { priceModeCopy } from '../../domain/price-modes';
import type { PriceMode } from '../../domain/price-modes';

const SHOWN_FOR_MS = 4500;

// Short confirmation each time the mode changes (from the top bar or from Paramètres), never on load.
export function PriceModeToast({ priceMode }: { priceMode: PriceMode }) {
  const previous = useRef(priceMode);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (previous.current === priceMode) return;
    previous.current = priceMode;
    setMessage(priceModeCopy[priceMode].toast);
    const hide = window.setTimeout(() => setMessage(''), SHOWN_FOR_MS);
    return () => window.clearTimeout(hide);
  }, [priceMode]);

  return (
    <div className="price-mode-toast-region" aria-live="polite">
      {message && <p className="price-mode-toast" key={message}>{message}</p>}
    </div>
  );
}
