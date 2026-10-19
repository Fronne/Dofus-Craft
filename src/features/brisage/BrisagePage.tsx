import { useMemo, useRef, useState } from 'react';
import runeItems from '../../data/rune-items.json';
import { useActiveServer } from '../../app/ServerContext';
import { Icon } from '../../components/Icon';
import { StatTile } from '../../components/StatTile';
import { getItemEffectLines } from '../../data/catalogue-repository';
import {
  BRISAGE_STATS,
  analyzeBrisage,
  brisageStat,
  runeForStat,
  type BrisageOption,
  type BrisageSettings,
  type RuneSize,
} from '../../domain/brisage';
import type { RuneItemsData } from '../../domain/forgemagie';
import type { PriceMode } from '../../domain/price-modes';
import type { Item } from '../../domain/types';
import { getBrisageSettings, resetBrisageSettings, setBrisageSettings } from '../../persistence/brisage-settings';
import { Kamas } from '../prices/PricesPage';
import { MIN_QUERY_LENGTH, useEquipmentSearch } from '../forgemagie/useEquipmentSearch';
import { useRunePrices } from './useRunePrices';

// specs/060-page-brisage: is breaking an item profitable, and is a focus worth it? Everything shown is
// an ESTIMATE from unofficial formulas (spec.md H1–H4) — the page says so and lets the weights be set.

const RUNES = (runeItems as RuneItemsData).runes;
const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const SIZES: { value: RuneSize; label: string }[] = [{ value: 'ba', label: 'Ba (simple)' }, { value: 'pa', label: 'Pa' }, { value: 'ra', label: 'Ra' }];

type LineDraft = { key: number; effectId: number; value: string };

const parse = (text: string): number => (text.trim() === '' ? NaN : Number(text.replace(/\s/g, '').replace(',', '.')));

function optionLabel(option: BrisageOption): string {
  return option.kind === 'normal' ? 'Pas de focus' : `Focus ${(option.focusRuneName ?? '').replace('Rune ', '')}`.trim();
}

function CoefficientCurve({ steps, threshold }: { steps: { index: number; coefficient: number }[]; threshold: number }) {
  const width = 360;
  const height = 120;
  if (steps.length < 2) return null;
  const max = steps[0].coefficient;
  const x = (index: number) => ((index - 1) / (steps.length - 1)) * (width - 20) + 10;
  const y = (coefficient: number) => height - 10 - (coefficient / max) * (height - 20);
  const points = steps.map((step) => `${x(step.index)},${y(step.coefficient)}`).join(' ');
  return (
    <svg className="brisage-curve" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Coefficient de ${steps[0].coefficient} % à ${steps[steps.length - 1].coefficient} % sur ${steps.length} objets`}>
      <line x1="10" x2={width - 10} y1={y(threshold)} y2={y(threshold)} className="brisage-curve-threshold" />
      <polyline points={points} className="brisage-curve-line" fill="none" />
    </svg>
  );
}

export function BrisagePage({ priceMode }: { priceMode: PriceMode }) {
  const { serverId } = useActiveServer();
  const [settings, setSettings] = useState<BrisageSettings>(() => getBrisageSettings());
  const [query, setQuery] = useState('');
  const search = useEquipmentSearch(query);
  const [itemName, setItemName] = useState('');
  const [level, setLevel] = useState('100');
  const [coefficient, setCoefficient] = useState('50');
  const [cost, setCost] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [manualPrices, setManualPrices] = useState<Record<string, string>>({});
  const nextKey = useRef(1);
  const pickToken = useRef(0);

  const update = (next: BrisageSettings) => {
    setSettings(next);
    setBrisageSettings(next);
  };

  const pick = (item: Item) => {
    const token = ++pickToken.current;
    setItemName(item.name);
    setQuery('');
    if (item.level) setLevel(String(item.level));
    setLoadState('loading');
    getItemEffectLines(item.id)
      .then((found) => {
        if (pickToken.current !== token) return;
        setLines(found.map((line) => ({ key: nextKey.current++, effectId: line.effectId, value: String(line.value) })));
        setLoadState('idle');
      })
      .catch(() => {
        if (pickToken.current === token) setLoadState('failed');
      });
  };

  const parsedLines = lines.map((line) => ({ effectId: line.effectId, value: parse(line.value) }));
  // The simple-rune ids of the lines: the prices to read.
  const runeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const line of lines) {
      const found = runeForStat(RUNES, line.effectId, settings.runeSize);
      if (found) ids.add(found.rune.id);
    }
    return [...ids].sort();
  }, [lines, settings.runeSize]);
  const fetched = useRunePrices(serverId, priceMode, runeIds);
  const prices: Record<string, number | undefined> = { ...fetched.prices };
  for (const [id, text] of Object.entries(manualPrices)) {
    const value = parse(text);
    if (value > 0) prices[id] = value;
  }

  const levelNumber = parse(level);
  const analysis = analyzeBrisage(
    { level: levelNumber, lines: parsedLines, coefficient: parse(coefficient), itemCostKamas: parse(cost) },
    RUNES,
    prices,
    settings,
  );
  const best = analysis.status === 'ok' ? analysis.best : undefined;
  const missingIds = analysis.status === 'ok' ? [...new Set(analysis.options.flatMap((o) => o.missingRuneIds))] : [];
  const unconfirmed = lines.map((line) => brisageStat(line.effectId)).filter((stat) => stat && !stat.confirmed).map((stat) => stat!.label);

  return (
    <>
      <header className="page-header">
        <h1>Brisage</h1>
        <p>Briser un objet est-il rentable ? Faut-il un focus, et sur quelle rune ?</p>
      </header>

      <div className="panel brisage-estimate" role="note">
        <Icon name="info" size={18} />
        <p>
          <b>Tout est une estimation.</b> La descente du coefficient suit une formule empirique mesurée sur des objets de
          niveau 40 (écart ≤ 2 %) : le niveau de l'objet change la vitesse réelle. Le nombre de runes vient d'une formule
          testée sur deux relevés de niveau 100. Le calcul du focus (ligne ciblée à {number.format(settings.focusTargetShare * 100)} %, autres
          lignes à {number.format(settings.focusOtherShare * 100)} %) est une <b>hypothèse non officielle</b> à confirmer par des relevés en jeu.
          Les poids sont des réglages que vous pouvez modifier plus bas.
        </p>
      </div>

      <section className="panel brisage-block" aria-labelledby="brisage-item">
        <h2 id="brisage-item">Objet</h2>
        <div className="search-input-wrap">
          <Icon name="search" size={18} className="search-input-icon" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Chercher un objet du catalogue…" aria-label="Chercher un objet" />
        </div>
        {query.trim().length >= MIN_QUERY_LENGTH && (
          <div>
            {search.status === 'searching' && <p className="fm-note" role="status">Recherche…</p>}
            {search.status === 'unavailable' && <p className="fm-error" role="alert">Le catalogue est indisponible pour le moment.</p>}
            {search.status === 'ready' && search.items.length === 0 && <p className="fm-note">Aucun objet ne correspond.</p>}
            {search.status === 'ready' && (
              <ul className="fm-picker-results">
                {search.items.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="fm-picker-result" onClick={() => pick(item)}>
                      <span>{item.name}</span>
                      {item.level !== undefined && <span className="fm-note">Niv. {item.level}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {itemName && <p className="brisage-picked">Objet choisi : <b>{itemName}</b></p>}
        {loadState === 'loading' && <p className="fm-note" role="status">Lecture des stats…</p>}
        {loadState === 'failed' && <p className="fm-error" role="alert">Les stats de cet objet n'ont pas pu être lues : saisissez les lignes à la main.</p>}

        <div className="brisage-fields">
          <label className="pet-level-field">Niveau de l'objet
            <input type="number" inputMode="numeric" min={1} max={200} value={level} onChange={(event) => setLevel(event.target.value)} />
          </label>
          <label className="pet-level-field">Coefficient actuel (%)
            <input type="number" inputMode="decimal" min={1} max={100} value={coefficient} onChange={(event) => setCoefficient(event.target.value)} />
          </label>
          <label className="pet-level-field">Coût de l'objet (kamas)
            <input type="number" inputMode="numeric" min={0} value={cost} onChange={(event) => setCost(event.target.value)} />
          </label>
        </div>

        <h3>Lignes de l'objet</h3>
        {lines.length === 0 && <p className="fm-note">Aucune ligne : choisissez un objet ou ajoutez des lignes à la main.</p>}
        <ul className="brisage-lines">
          {lines.map((line) => (
            <li key={line.key}>
              <select
                aria-label="Stat de la ligne"
                value={line.effectId}
                onChange={(event) => setLines(lines.map((l) => (l.key === line.key ? { ...l, effectId: Number(event.target.value) } : l)))}
              >
                {!brisageStat(line.effectId) && <option value={line.effectId}>Effet {line.effectId} (inconnu)</option>}
                {BRISAGE_STATS.map((stat) => <option key={stat.effectId} value={stat.effectId}>{stat.label}</option>)}
              </select>
              <input
                type="number" inputMode="decimal" min={0} aria-label={`Valeur de la ligne ${brisageStat(line.effectId)?.label ?? line.effectId}`}
                value={line.value}
                onChange={(event) => setLines(lines.map((l) => (l.key === line.key ? { ...l, value: event.target.value } : l)))}
              />
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setLines(lines.filter((l) => l.key !== line.key))} aria-label={`Retirer la ligne ${brisageStat(line.effectId)?.label ?? line.effectId}`}>Retirer</button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setLines([...lines, { key: nextKey.current++, effectId: BRISAGE_STATS[0].effectId, value: '' }])}>
          Ajouter une ligne
        </button>
        {unconfirmed.length > 0 && (
          <p className="fm-note">Poids à confirmer par un relevé : {[...new Set(unconfirmed)].join(', ')}.</p>
        )}
      </section>

      <section className="brisage-results" aria-labelledby="brisage-results-title">
        <h2 id="brisage-results-title">Résultat</h2>
        {analysis.status === 'invalid' ? (
          <p className="empty" role="status">{analysis.reason}</p>
        ) : (
          <>
            {fetched.communityUnavailable && <p className="fm-note" role="status">Les prix partagés sont injoignables : seuls vos prix enregistrés et saisis sont utilisés.</p>}
            {analysis.ignoredEffectIds.length > 0 && (
              <p className="fm-note">{analysis.ignoredEffectIds.length} ligne(s) sans poids ni rune connus ne sont pas comptées.</p>
            )}
            {missingIds.length > 0 && (
              <p className="fm-note" role="status">
                Prix manquant pour {missingIds.length} rune(s) : saisissez-les ci-dessous, aucun prix n'est inventé.
              </p>
            )}
            <div className="stat-tile-row" aria-live="polite">
              <StatTile
                icon="trending-up"
                label="Meilleure option"
                value={best ? (best.gainKamas! < 0 ? 'Pas rentable' : optionLabel(best)) : 'Prix manquants'}
                hint={best ? `${best.gainKamas! >= 0 ? '+' : '−'}${number.format(Math.abs(best.gainKamas!))} kamas par objet` : undefined}
              />
              <StatTile
                icon="anvil"
                label="Coefficient minimal rentable"
                value={analysis.thresholdCoefficient === undefined ? '—' : `${number.format(analysis.thresholdCoefficient)} %`}
                hint="Brisage normal"
              />
              <StatTile
                icon="package"
                label="Objets à briser"
                value={analysis.itemsCount === undefined ? '—' : String(analysis.itemsCount)}
                hint="Estimation, formule niveau 40"
              />
            </div>

            <h3>Classement des options</h3>
            <p className="fm-note">Focus : estimation non officielle, à confirmer en jeu.</p>
            <div className="brisage-table-wrap">
              <table className="brisage-table">
                <thead>
                  <tr><th scope="col">#</th><th scope="col">Option</th><th scope="col">Runes</th><th scope="col">Valeur</th><th scope="col">Gain par objet</th></tr>
                </thead>
                <tbody>
                  {analysis.options.map((option, index) => (
                    <tr key={`${option.kind}-${option.focusEffectId ?? 'n'}`} className={option === best ? 'brisage-best' : undefined}>
                      <td>{option.gainKamas === undefined ? '—' : index + 1}</td>
                      <td>{optionLabel(option)}</td>
                      <td>
                        {option.yields.filter((y) => y.count >= 0.05).map((y) => `${number.format(y.count)} ${y.runeName.replace('Rune ', '')}`).join(', ')}
                      </td>
                      <td>{option.missingRuneIds.length > 0 ? <span className="fm-note">prix manquant</span> : <Kamas value={Math.round(option.valueKamas)} />}</td>
                      <td>{option.gainKamas === undefined ? <span className="fm-note">—</span> : <Kamas value={Math.round(option.gainKamas)} signed />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {analysis.thresholdCoefficient !== undefined && (
              <>
                <h3>Descente du coefficient</h3>
                {analysis.descent.length === 0 ? (
                  <p className="empty" role="status">Le coefficient actuel est déjà sous le seuil ({number.format(analysis.thresholdCoefficient)} %) : briser ne rapporte pas.</p>
                ) : (
                  <>
                    <CoefficientCurve steps={analysis.descent} threshold={analysis.thresholdCoefficient} />
                    <div className="brisage-table-wrap brisage-descent">
                      <table className="brisage-table">
                        <thead><tr><th scope="col">Objet n°</th><th scope="col">Coefficient</th><th scope="col">Valeur des runes</th><th scope="col">Gain</th></tr></thead>
                        <tbody>
                          {analysis.descent.map((step) => (
                            <tr key={step.index}>
                              <td>{step.index}</td>
                              <td>{step.coefficient} %</td>
                              <td><Kamas value={Math.round(step.valueKamas)} /></td>
                              <td><Kamas value={Math.round(step.gainKamas)} signed /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}

            <h3>Prix des runes</h3>
            <p className="fm-note">
              {priceMode === 'community' ? 'Prix partagés par la communauté' : 'Vos prix enregistrés'} ; une valeur saisie ici remplace le prix lu.
            </p>
            <ul className="brisage-prices">
              {runeIds.map((id) => {
                const rune = RUNES.find((r) => r.id === id)!;
                return (
                  <li key={id}>
                    <label>
                      <span>{rune.name}</span>
                      <input
                        type="number" inputMode="numeric" min={0} aria-label={`Prix de ${rune.name}`}
                        placeholder={fetched.prices[id] !== undefined ? String(fetched.prices[id]) : 'prix ?'}
                        value={manualPrices[id] ?? ''}
                        onChange={(event) => setManualPrices({ ...manualPrices, [id]: event.target.value })}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <details className="panel brisage-block brisage-settings">
        <summary>Réglages des poids et rendements</summary>
        <p className="fm-note">Valeurs par défaut = hypothèses du projet. Modifiez-les pour coller à vos relevés ; elles sont gardées sur cet appareil.</p>
        <div className="brisage-fields">
          <label className="pet-level-field">Facteur de niveau
            <input type="number" step="0.001" min={0} value={settings.levelFactor} onChange={(event) => update({ ...settings, levelFactor: Math.max(0, Number(event.target.value) || 0) })} />
          </label>
          <label className="pet-level-field">Bonus de ligne
            <input type="number" step="0.1" min={0} value={settings.lineBonus} onChange={(event) => update({ ...settings, lineBonus: Math.max(0, Number(event.target.value) || 0) })} />
          </label>
          <label className="pet-level-field">Focus : part de la ligne ciblée (%)
            <input type="number" min={0} max={100} value={Math.round(settings.focusTargetShare * 100)} onChange={(event) => update({ ...settings, focusTargetShare: Math.min(1, Math.max(0, (Number(event.target.value) || 0) / 100)) })} />
          </label>
          <label className="pet-level-field">Focus : part des autres lignes (%)
            <input type="number" min={0} max={100} value={Math.round(settings.focusOtherShare * 100)} onChange={(event) => update({ ...settings, focusOtherShare: Math.min(1, Math.max(0, (Number(event.target.value) || 0) / 100)) })} />
          </label>
          <label className="pet-level-field">Taille de rune valorisée
            <select value={settings.runeSize} onChange={(event) => update({ ...settings, runeSize: event.target.value as RuneSize })}>
              {SIZES.map((size) => <option key={size.value} value={size.value}>{size.label}</option>)}
            </select>
          </label>
          {SIZES.map((size) => (
            <label className="pet-level-field" key={size.value}>Poids {size.label} (× rune simple)
              <input type="number" min={0} value={settings.sizeMultipliers[size.value]} onChange={(event) => update({ ...settings, sizeMultipliers: { ...settings.sizeMultipliers, [size.value]: Math.max(0, Number(event.target.value) || 0) } })} />
            </label>
          ))}
        </div>
        <div className="brisage-table-wrap">
          <table className="brisage-table">
            <thead><tr><th scope="col">Stat</th><th scope="col">Poids par point</th><th scope="col">Points de la rune Ba</th><th scope="col">État</th></tr></thead>
            <tbody>
              {BRISAGE_STATS.map((stat) => {
                const current = settings.stats[stat.effectId] ?? { weight: stat.weight, runePoints: stat.runePoints };
                const set = (patch: Partial<typeof current>) => update({ ...settings, stats: { ...settings.stats, [stat.effectId]: { ...current, ...patch } } });
                return (
                  <tr key={stat.effectId}>
                    <td>{stat.label}</td>
                    <td><input type="number" step="any" min={0} aria-label={`Poids de ${stat.label}`} value={current.weight} onChange={(event) => set({ weight: Math.max(0, Number(event.target.value) || 0) })} /></td>
                    <td><input type="number" step="any" min={0} aria-label={`Points de la rune ${stat.label}`} value={current.runePoints} onChange={(event) => set({ runePoints: Math.max(0, Number(event.target.value) || 0) })} /></td>
                    <td className="fm-note">{stat.confirmed ? 'recoupé par un relevé' : 'à confirmer'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setSettings(resetBrisageSettings())}>Rétablir les valeurs par défaut</button>
      </details>
    </>
  );
}

