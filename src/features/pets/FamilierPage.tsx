import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveServer } from '../../app/ServerContext';
import { ROUTES } from '../../app/router';
import { EmptyState } from '../../components/EmptyState';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import { Kamas } from '../prices/PricesPage';
import { classifyPriceAge } from '../../domain/price-age';
import type { PriceMode } from '../../domain/price-modes';
import { formatRelativeTime } from '../../domain/time';
import { Icon } from '../../components/Icon';
import { normalizeSearchText } from '../../services/dofusdb-api';
import {
  PET_FOODS,
  PET_MAX_LEVEL,
  PET_MIN_LEVEL,
  PET_XP_SOURCE,
  ALMANAX_PET_XP_MULTIPLIER,
  isPetXpAlmanaxDay,
  DEFAULT_PET_FOOD_SORT,
  MAX_RECOMMENDATIONS,
  planPetFood,
  validatePetLevels,
  xpNeeded,
  type PetFoodRecommendation,
  type PetFoodSort,
  type PetFoodSortKey,
  type PetLevelsInput,
} from '../../domain/pet-xp';
import { getPetLevels, setPetLevels } from '../../persistence/pet-levels-preference';
import { usePetFoodPrices } from './usePetFoodPrices';

// specs/022-pet-xp-calculator: the XP a pet still needs to reach a level, and the cheapest resources
// to feed it with on the active server, in the active price mode.

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });

type Field = keyof PetLevelsInput;
// The two levels come first; the XP already gained, optional and of lesser importance, comes last
// and is shown more discreetly.
const FIELDS: { key: Field; label: string; min: number; max?: number; secondary?: boolean }[] = [
  { key: 'currentLevel', label: 'Niveau actuel', min: PET_MIN_LEVEL, max: PET_MAX_LEVEL - 1 },
  { key: 'targetLevel', label: 'Niveau visé', min: PET_MIN_LEVEL + 1, max: PET_MAX_LEVEL },
  { key: 'xpInLevel', label: 'XP déjà gagnée dans ce niveau', min: 0, secondary: true },
];

const toText = (levels: PetLevelsInput): Record<Field, string> => ({
  currentLevel: String(levels.currentLevel),
  xpInLevel: String(levels.xpInLevel),
  targetLevel: String(levels.targetLevel),
});

// A level typed above its maximum (e.g. 150) is brought back to that maximum right away, rather than
// left in the field with an error.
const clampToMax = (value: string, max: number | undefined) =>
  max !== undefined && value.trim() !== '' && Number(value) > max ? String(max) : value;

const parse = (text: string) => (text.trim() === '' ? Number.NaN : Number(text));

// Clicking a column header sorts the whole priced list by it, then keeps the first 10 lines: first
// click in the most useful direction (A → Z, most XP per unit, cheapest), second click the other way.
const COLUMNS: { key: PetFoodSortKey; label: string; first: PetFoodSort['direction'] }[] = [
  { key: 'name', label: 'Ressource', first: 'asc' },
  { key: 'xpPerUnit', label: 'XP', first: 'desc' },
  { key: 'unitPrice', label: 'Prix unitaire', first: 'asc' },
  { key: 'quantity', label: 'Quantité', first: 'asc' },
  { key: 'total', label: 'Coût total', first: 'asc' },
];

function SortHeader({ sort, onSort }: { sort: PetFoodSort; onSort: (sort: PetFoodSort) => void }) {
  return (
    <div className="profit-head pet-food-row" role="group" aria-label="Trier la liste">
      {COLUMNS.map((column) => {
        const active = sort.key === column.key;
        return (
          <button
            key={column.key}
            type="button"
            className={`profit-sort${active ? ' profit-sort--active' : ''}`}
            aria-pressed={active}
            aria-label={`Trier par ${column.label}`}
            onClick={() => onSort({
              key: column.key,
              direction: active ? (sort.direction === 'asc' ? 'desc' : 'asc') : column.first,
            })}
          >
            {column.label}
            {active && <span aria-hidden="true">{sort.direction === 'desc' ? ' ↓' : ' ↑'}</span>}
          </button>
        );
      })}
    </div>
  );
}

function FoodLine({ line }: { line: PetFoodRecommendation }) {
  const age = classifyPriceAge(line.priceDate);
  const ageClass = age === 'stale' ? ' market-date--stale' : age === 'expired' ? ' market-date--expired' : '';
  return (
    <li className="profit-row pet-food-row">
      <div className="profit-row-main">
        <ResourceDisplay resource={{ id: line.food.itemId, name: line.food.name, imageUrl: line.food.imageUrl }} />
      </div>
      <div className="profit-cell">
        <span className="profit-cell-label">XP</span>
        <b>{numberFormat.format(line.xpPerUnit)}</b>
      </div>
      <div className="profit-cell">
        <span className="profit-cell-label">Prix unitaire</span>
        <b><Kamas value={line.unitPriceKamas} /></b>
        <small className={`market-date${ageClass}`}>
          {line.priceOrigin === 'community-median' ? 'Médiane · ' : ''}
          {line.priceDate ? formatRelativeTime(line.priceDate) : 'date inconnue'}
        </small>
      </div>
      <div className="profit-cell">
        <span className="profit-cell-label">Quantité</span>
        <b>{numberFormat.format(line.quantity)}</b>
      </div>
      <div className="profit-cell">
        <span className="profit-cell-label">Coût total</span>
        <b><Kamas value={line.totalKamas} /></b>
      </div>
    </li>
  );
}

export function FamilierPage({ priceMode }: { priceMode: PriceMode }) {
  const { serverId, servers } = useActiveServer();
  const [text, setText] = useState(() => toText(getPetLevels()));
  const [sort, setSort] = useState<PetFoodSort>(DEFAULT_PET_FOOD_SORT);
  const [query, setQuery] = useState('');
  // FR-012: on by itself on 23 July, the day of the pet XP Almanax; never remembered.
  const [almanax, setAlmanax] = useState(() => isPetXpAlmanaxDay());
  const levels: PetLevelsInput = {
    currentLevel: parse(text.currentLevel),
    xpInLevel: text.xpInLevel.trim() === '' ? 0 : parse(text.xpInLevel),
    targetLevel: parse(text.targetLevel),
  };
  const errors = validatePetLevels(levels);
  const valid = Object.keys(errors).length === 0;
  const xp = valid ? xpNeeded(levels) : undefined;

  useEffect(() => {
    if (valid) setPetLevels(levels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, levels.currentLevel, levels.xpInLevel, levels.targetLevel]);

  const { status, prices, communityUnavailable } = usePetFoodPrices(serverId, priceMode);
  // The name search narrows the resources before sorting and keeping the first 10 lines.
  const normalizedQuery = normalizeSearchText(query);
  const foods = normalizedQuery ? PET_FOODS.filter((food) => normalizeSearchText(food.name).includes(normalizedQuery)) : PET_FOODS;
  const plan = xp !== undefined ? planPetFood(xp, foods, prices, MAX_RECOMMENDATIONS, sort, almanax ? ALMANAX_PET_XP_MULTIPLIER : 1) : undefined;
  const unpricedCount = PET_FOODS.filter((food) => !(prices[food.itemId]?.unitPriceKamas > 0)).length;
  const hasAnyPrice = unpricedCount < PET_FOODS.length;
  const serverName = servers.find((server) => server.id === serverId)?.name;
  const modeLabel = priceMode === 'community' ? 'Mode communautaire' : 'Mode personnel';

  return (
    <>
      <header className="page-header">
        <h1>Familier</h1>
        <p>
          XP à donner à votre familier et ressources les moins chères pour y arriver
          {serverName ? `, serveur ${serverName}` : ''}, {modeLabel}.
        </p>
      </header>

      <section className="panel pet-levels-panel">
        <div className="pet-levels">
          {FIELDS.map((field) => (
            <label key={field.key} className={`pet-level-field${field.secondary ? ' pet-level-field--secondary' : ''}`}>
              <span>
                {field.label}
                {field.secondary && <small> (facultatif)</small>}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={field.min}
                max={field.max}
                step={1}
                value={text[field.key]}
                aria-invalid={errors[field.key] ? true : undefined}
                onChange={(event) => setText((current) => ({ ...current, [field.key]: clampToMax(event.target.value, field.max) }))}
              />
              {errors[field.key] && <small className="warning" role="alert">{errors[field.key]}</small>}
            </label>
          ))}
        </div>
        {xp !== undefined && (
          <p className="pet-xp-needed" role="status">
            {xp > 0 ? (
              <>XP nécessaire : <b>{numberFormat.format(xp)} XP</b></>
            ) : (
              'Aucune XP à donner : le niveau visé est déjà atteint.'
            )}
          </p>
        )}
        <label className="pet-almanax-switch">
          <input
            type="checkbox"
            role="switch"
            checked={almanax}
            onChange={(event) => setAlmanax(event.target.checked)}
          />
          <span className="pet-almanax-switch-track" aria-hidden="true" />
          <span>
            Almanax du 23 juillet (+50 % d'XP)
            {isPetXpAlmanaxDay() && <small> · c'est aujourd'hui</small>}
          </span>
        </label>
      </section>

      {plan && plan.xpNeeded > 0 && (
        <section className="panel profit-panel">
          <h2>{sort.key === 'total' && sort.direction === 'asc' && !normalizedQuery ? 'Ressources les moins chères' : 'Ressources'}</h2>
          {!serverId ? (
            <EmptyState icon="coins" title="Aucun serveur choisi" description="Choisissez un serveur pour voir le prix des ressources." />
          ) : status === 'loading' ? (
            <p className="empty" role="status">Chargement des prix…</p>
          ) : !hasAnyPrice ? (
            <>
              <EmptyState
                icon="coins"
                title="Aucune recommandation sans prix"
                description="Saisissez des prix de ressources depuis la page Recherche pour voir les moins chères."
              />
              <p className="profit-empty-link"><Link to={ROUTES.search}>Aller à la page Recherche</Link></p>
            </>
          ) : (
            <>
              <div className="profit-toolbar">
                <div className="search-input-wrap prices-search">
                  <Icon name="search" size={18} className="search-input-icon" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Rechercher une ressource..."
                    aria-label="Rechercher une ressource"
                  />
                </div>
              </div>
              {plan.recommendations.length === 0 ? (
                <EmptyState
                  icon="search"
                  title="Aucune ressource avec un prix ne correspond"
                  description={foods.length > 0
                    ? `${numberFormat.format(foods.length)} ${foods.length === 1 ? 'ressource correspond' : 'ressources correspondent'}, mais sans prix connu.`
                    : 'Essayez un autre nom de ressource.'}
                />
              ) : (
                <>
                  <SortHeader sort={sort} onSort={setSort} />
                  <ul className="profit-list">
                    {plan.recommendations.map((line) => <FoodLine key={line.food.itemId} line={line} />)}
                  </ul>
                </>
              )}
            </>
          )}
          {status === 'ready' && (
            <div className="pet-food-notes">
              {communityUnavailable && (
                <p className="warning">Prix communautaires indisponibles pour le moment : seuls vos prix sont utilisés.</p>
              )}
              <p>
                {numberFormat.format(unpricedCount)} {unpricedCount === 1 ? 'ressource sans prix connu n’est pas proposée' : 'ressources sans prix connu ne sont pas proposées'}.
              </p>
              <p>
                XP par ressource : <a href={PET_XP_SOURCE.url} target="_blank" rel="noreferrer">{PET_XP_SOURCE.name}</a>
                {' '}(relevé du {new Date(PET_XP_SOURCE.retrievedAt).toLocaleDateString('fr-FR')}) ; ces valeurs communautaires peuvent être
                incomplètes. XP par niveau : fichiers du jeu.
              </p>
            </div>
          )}
        </section>
      )}
    </>
  );
}
