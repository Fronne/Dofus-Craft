import { useState } from 'react';
import { hasLegacyPinnedItemMarketPrice } from '../../persistence/pinned-items';

export function PinnedPriceMigrationNotice() {
  const [hasLegacyPrice] = useState(() => hasLegacyPinnedItemMarketPrice());
  const [dismissed, setDismissed] = useState(false);

  if (!hasLegacyPrice || dismissed) return null;

  return (
    <div role="status" className="pinned-price-migration-notice">
      <p>
        Vos anciens prix HDV enregistrés pour vos items épinglés ont été abandonnés lors de cette
        mise à jour : ils doivent désormais être ressaisis pour chaque serveur.
      </p>
      <button type="button" onClick={() => setDismissed(true)}>
        Fermer
      </button>
    </div>
  );
}
