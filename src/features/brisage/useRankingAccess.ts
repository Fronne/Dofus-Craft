import { useState } from 'react';
import { useSiteSettings } from '../../app/useSiteSettings';
import { applyRankingAccessFromSearch, withoutRankingParameter } from '../../persistence/brisage-ranking-access';

/**
 * specs/072-classement-brisage (US6): the Classement tab exists only for the owner, who opens it with `?classement=1`.
 * The owner can also open it to everyone with the shared `brisageRanking` setting (administration page).
 */
export function useRankingAccess(): boolean {
  const [localRankingAccess] = useState(() => {
    const { access, touched } = applyRankingAccessFromSearch(window.location.search);
    if (touched) window.history.replaceState(window.history.state, '', withoutRankingParameter(window.location));
    return access;
  });
  const { settings: siteSettings } = useSiteSettings();
  return localRankingAccess || siteSettings.brisageRanking;
}
