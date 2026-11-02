import { useState } from 'react';
import type { FmMe } from '../../domain/forgemagie';

// specs/082-auteur-prix-communautaires (US2): the same privacy setting as the Forgemagie's, told for the prices —
// public shows the Discord pseudonym on the prices entered, private shows only when they were updated.
export function PricePrivacy({ me, updateMe }: { me: FmMe; updateMe: (changes: { isPrivate?: boolean }) => Promise<boolean> }) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const change = async (isPrivate: boolean) => {
    setSaving(true);
    setFailed(false);
    setFailed(!(await updateMe({ isPrivate })));
    setSaving(false);
  };

  return (
    <section className="profile-privacy" aria-labelledby="privacy-title">
      <h2 id="privacy-title">Confidentialité</h2>
      <p className="fm-note">
        Ce réglage décide si ton pseudo est affiché sur les prix que tu saisis. En privé, seul le moment de la mise à jour reste visible.
      </p>
      <div className="hdv-price-filters" role="group" aria-label="Confidentialité du profil">
        {([false, true] as const).map((isPrivate) => (
          <button
            key={String(isPrivate)}
            type="button"
            aria-pressed={me.isPrivate === isPrivate}
            className={`hdv-price-filter${me.isPrivate === isPrivate ? ' hdv-price-filter--active' : ''}`}
            disabled={saving}
            onClick={() => void change(isPrivate)}
          >
            {isPrivate ? 'Privé' : 'Public'}
          </button>
        ))}
      </div>
      {failed && <p className="fm-error" role="alert">Le réglage n'a pas pu être enregistré. Réessaie.</p>}
    </section>
  );
}
