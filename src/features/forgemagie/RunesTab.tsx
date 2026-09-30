import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveServer } from '../../app/ServerContext';
import { CharacteristicIcon } from '../../components/CharacteristicIcon';
import { CHARACTERISTIC_ASSET_BY_ID } from '../../domain/characteristic-icons';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import runeItems from '../../data/rune-items.json';
import { PRICE_ORIGIN_LABELS, runeStatLabels, type FmMe, type PriceOrigin, type RuneItemsData } from '../../domain/forgemagie';
import type { PriceMode } from '../../domain/price-modes';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import { getCommunityPrices } from '../../services/community-price-api';
import { normalizeSearchText } from '../../services/dofusdb-api';
import { PriceEntryField } from '../comparison/PriceEntryField';
import { useResourcePrices } from '../comparison/useResourcePrices';
import { CaptureImport } from './CaptureImport';

// specs/025-rune-purchase-import (US4, FR-017, FR-018): every rune with its price on the site's active
// server, the same price field as the HDV page (manual entry, date, old prices, history, outlier
// confirmation), plus the origin of the latest shared price. The capture import sits on top (US5).

const runes = (runeItems as RuneItemsData).runes;
const statLabels = runeStatLabels(runes);

/** The origin of each rune's latest shared price, in Mode communautaire only. */
function useLatestOrigins(serverId: string | undefined, priceMode: PriceMode, version: number) {
  const [origins, setOrigins] = useState<Record<string, PriceOrigin>>({});
  useEffect(() => {
    if (!serverId || priceMode !== 'community') {
      setOrigins({});
      return;
    }
    let cancelled = false;
    void getCommunityPrices(runes.map((rune) => rune.id), serverId).then((lookup) => {
      if (cancelled || lookup.status !== 'found') return;
      // A price without origin (older Worker, or a manual entry) is a manual entry.
      setOrigins(Object.fromEntries(lookup.prices.map((price) => [price.resourceId, price.latestOrigin ?? 'manual'])));
    });
    return () => {
      cancelled = true;
    };
  }, [serverId, priceMode, version]);
  return origins;
}

export function RunesTab({ me, priceMode }: { me: FmMe; priceMode: PriceMode }) {
  const { serverId, servers } = useActiveServer();
  const [query, setQuery] = useState('');
  const [stat, setStat] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);
  useEffect(() => {
    setInputs({});
  }, [serverId, priceMode]);

  const filtered = useMemo(() => {
    const search = normalizeSearchText(query);
    return runes.filter((rune) => (!stat || rune.statLabel === stat) && (!search || normalizeSearchText(rune.name).includes(search)));
  }, [query, stat]);
  const { data: carnet, save, remove, loaded } = useResourcePrices(serverId, filtered.map((rune) => rune.id), resourcePricesFor(priceMode));
  const origins = useLatestOrigins(serverId, priceMode, version);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  const serverName = servers.find((server) => server.id === serverId)?.name;
  const profileServerName = servers.find((server) => server.id === me.serverId)?.name;

  return (
    <div className="fm-runes">
      <CaptureImport me={me} priceMode={priceMode} onImported={refresh} />
      {me.serverId && me.serverId !== serverId && (
        <p className="fm-note">
          Les captures importées sont rangées sur ton serveur de profil ({profileServerName ?? me.serverId}) ; la liste ci-dessous montre
          les prix de {serverName ?? 'ce serveur'}.
        </p>
      )}

      <div className="profit-toolbar hdv-toolbar">
        <div className="search-input-wrap prices-search">
          <Icon name="search" size={18} className="search-input-icon" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une rune..." aria-label="Rechercher une rune" />
        </div>
        <select className="hdv-type-filter" aria-label="Stat" value={stat} onChange={(event) => setStat(event.target.value)}>
          <option value="">Toutes les stats</option>
          {statLabels.map((label) => <option key={label} value={label}>{label}</option>)}
        </select>
      </div>

      {!serverId ? (
        <EmptyState icon="server" title="Aucun serveur choisi" description="Choisissez un serveur pour voir le prix des runes." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="search" title="Aucune rune ne correspond à votre recherche" description="Essayez un autre nom ou une autre stat." />
      ) : (
        <ul className="hdv-list">
          {filtered.map((rune) => (
            <li key={rune.id} className="hdv-row">
              <PriceEntryField
                resource={{ id: rune.id, name: rune.name, imageUrl: rune.imageUrl }}
                quantity={1}
                subtotalKamas={null}
                caption={(
                  <span className="hdv-item-type fm-rune-caption">
                    {rune.characteristicId !== null && CHARACTERISTIC_ASSET_BY_ID[rune.characteristicId] && (
                      <CharacteristicIcon asset={CHARACTERISTIC_ASSET_BY_ID[rune.characteristicId]} size={16} />
                    )}
                    {rune.statLabel}
                    {origins[rune.id] && <span className="fm-origin">{PRICE_ORIGIN_LABELS[origins[rune.id]]}</span>}
                  </span>
                )}
                priceMode={priceMode}
                serverId={serverId}
                input={inputs[rune.id]}
                onInput={(value) => setInputs((current) => ({ ...current, [rune.id]: value }))}
                carnet={{ data: carnet, save, remove, loaded }}
                onSaved={refresh}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
