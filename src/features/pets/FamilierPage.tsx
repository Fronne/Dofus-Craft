import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveServer } from '../../app/ServerContext';
import { ROUTES } from '../../app/router';
import { BackToTopButton } from '../../components/BackToTopButton';
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
  PET_XP_CURVE,
  levelForTotalXp,
  maxTotalXp,
  ALMANAX_PET_XP_MULTIPLIER,
  isPetXpAlmanaxDay,
  DEFAULT_PET_FOOD_SORT,
  capPetFoodQuantity,
  planPetFood,
  validatePetLevels,
  xpNeeded,
  type PetFoodRecommendation,
  type PetFoodSort,
  type PetFoodSortKey,
  type PetLevelsInput,
} from '../../domain/pet-xp';
import { getPetLevels, setPetLevels } from '../../persistence/pet-levels-preference';
import { getPetMaxQuantity, setPetMaxQuantity } from '../../persistence/pet-max-quantity-preference';
import { usePetFoodPrices } from './usePetFoodPrices';
import { useLoadMoreOnScroll } from '../../hooks/useLoadMoreOnScroll';

// specs/022-pet-xp-calculator: the XP a pet still needs to reach a level, and the cheapest resources
// to feed it with on the active server, in the active price mode.

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });

type Field = 'currentLevel' | keyof PetLevelsInput;
// FR-002 (revised 2026-09-28): the current level and the pet's total XP are linked — typing a level
// fills the total XP with that level's cumulative XP, typing a total XP updates the level. The
// calculation always starts from the total XP, shown below the levels and more discreetly.
const FIELDS: Record<Field, { key: Field; label: string; min: number; max: number; secondary?: boolean }> = {
  currentLevel: { key: 'currentLevel', label: 'Niveau actuel', min: PET_MIN_LEVEL, max: PET_MAX_LEVEL },
  targetLevel: { key: 'targetLevel', label: 'Niveau visé', min: PET_MIN_LEVEL + 1, max: PET_MAX_LEVEL },
  totalXp: { key: 'totalXp', label: 'XP totale du familier', min: 0, max: maxTotalXp(), secondary: true },
};

const toText = (levels: PetLevelsInput): Record<Field, string> => ({
  currentLevel: String(levelForTotalXp(levels.totalXp).level),
  totalXp: String(levels.totalXp),
  targetLevel: String(levels.targetLevel),
});

const isIntegerIn = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;

// An emptied « Niveau actuel » counts as level 0 (FR-002, 2026-09-29): no error, the total XP back to 0,
// and the field shows « 0 » as its placeholder.
const parseCurrentLevel = (text: string) => (text.trim() === '' ? PET_MIN_LEVEL : parse(text));

/** The fields after `key` was typed, with the linked field (level ↔ total XP) kept in step. */
function withField(text: Record<Field, string>, key: Field, raw: string): Record<Field, string> {
  const value = clampToMax(raw, FIELDS[key].max);
  const next = { ...text, [key]: value };
  const number = key === 'currentLevel' ? parseCurrentLevel(value) : parse(value);
  if (key === 'currentLevel' && isIntegerIn(number, PET_MIN_LEVEL, PET_MAX_LEVEL)) {
    next.totalXp = String(PET_XP_CURVE[number]);
  } else if (key === 'totalXp' && isIntegerIn(number, 0, maxTotalXp())) {
    next.currentLevel = String(levelForTotalXp(number).level);
  }
  return next;
}

// A level typed above its maximum (e.g. 150) is brought back to that maximum right away, rather than
// left in the field with an error.
const clampToMax = (value: string, max: number | undefined) =>
  max !== undefined && value.trim() !== '' && Number(value) > max ? String(max) : value;

const parse = (text: string) => (text.trim() === '' ? Number.NaN : Number(text));

// Clicking a column header sorts the whole priced list by it: first click in the most useful direction
// (A → Z, most XP per unit, cheapest), second click the other way.
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
  // FR-008b: the « Quantité max » typed, and the cap in force (the last valid value; none when emptied).
  const [maxQuantity, setMaxQuantity] = useState<number | undefined>(() => getPetMaxQuantity());
  const [maxQuantityText, setMaxQuantityText] = useState(() => (maxQuantity === undefined ? '' : String(maxQuantity)));
  const maxQuantityValid = maxQuantityText === '' || (Number.isInteger(Number(maxQuantityText)) && Number(maxQuantityText) > 0);
  // FR-012: on by itself on 23 July, the day of the pet XP Almanax; never remembered.
  const [almanax, setAlmanax] = useState(() => isPetXpAlmanaxDay());
  const levels: PetLevelsInput = {
    totalXp: parse(text.totalXp),
    targetLevel: parse(text.targetLevel),
  };
  const errors = validatePetLevels(levels);
  const valid = Object.keys(errors).length === 0;
  const xp = valid ? xpNeeded(levels) : undefined;
  const fieldErrors: Partial<Record<Field, string>> = {
    ...errors,
    ...(isIntegerIn(parseCurrentLevel(text.currentLevel), PET_MIN_LEVEL, PET_MAX_LEVEL) ? {} : { currentLevel: `Niveau entre ${PET_MIN_LEVEL} et ${PET_MAX_LEVEL}.` }),
  };

  useEffect(() => {
    if (valid) setPetLevels(levels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, levels.totalXp, levels.targetLevel]);

  const [attempt, setAttempt] = useState(0);
  const { status, prices, communityUnavailable } = usePetFoodPrices(serverId, priceMode, attempt);
  // The name search narrows the resources before sorting. Every priced resource is listed, shown 25
  // lines at a time as the end of the list scrolls into view, like Rentabilité (FR-007, revised
  // 2026-09-28); a new search or sort goes back to the first lines.
  const normalizedQuery = normalizeSearchText(query);
  const foods = normalizedQuery ? PET_FOODS.filter((food) => normalizeSearchText(food.name).includes(normalizedQuery)) : PET_FOODS;
  const plan = xp !== undefined ? planPetFood(xp, foods, prices, Number.POSITIVE_INFINITY, sort, almanax ? ALMANAX_PET_XP_MULTIPLIER : 1) : undefined;
  // FR-008b: lines needing more units than the cap are hidden, before the list is shown in slices.
  const capped = capPetFoodQuantity(plan?.recommendations ?? [], maxQuantity);
  const { visible, endRef, loadingMore, reset: resetShown } = useLoadMoreOnScroll(capped.shown);
  const changeMaxQuantity = (raw: string) => {
    setMaxQuantityText(raw);
    const next = raw === '' ? undefined : Number(raw);
    if (next !== undefined && !(Number.isInteger(next) && next > 0)) return;
    setMaxQuantity(next);
    setPetMaxQuantity(next);
    resetShown();
  };
  const unpricedCount = PET_FOODS.filter((food) => !(prices[food.itemId]?.unitPriceKamas > 0)).length;
  const hasAnyPrice = unpricedCount < PET_FOODS.length;
  const serverName = servers.find((server) => server.id === serverId)?.name;
  const modeLabel = priceMode === 'community' ? 'Mode communautaire' : 'Mode personnel';

  const renderField = (field: (typeof FIELDS)[Field]) => (
    <label key={field.key} className={`pet-level-field${field.secondary ? ' pet-level-field--secondary' : ''}`}>
      <span>{field.label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={field.min}
        max={field.max}
        step={1}
        value={text[field.key]}
        placeholder={field.key === 'currentLevel' ? String(PET_MIN_LEVEL) : undefined}
        aria-invalid={fieldErrors[field.key] ? true : undefined}
        onChange={(event) => setText((current) => withField(current, field.key, event.target.value))}
      />
      {fieldErrors[field.key] && <small className="warning" role="alert">{fieldErrors[field.key]}</small>}
    </label>
  );

  return (
    <>
      <header className="page-header">
        <h1>XP Familier</h1>
        <p>
          XP à donner à votre familier et ressources les moins chères pour y arriver
          {serverName ? `, serveur ${serverName}` : ''}, {modeLabel}.
        </p>
      </header>

      <section className="panel pet-levels-panel">
        {/* Left: what the player types (current level → level aimed for, the linked total XP below).
            Right: the result, with the Almanax switch that changes how it is reached. */}
        <div className="pet-levels-inputs">
          <div className="pet-levels">
            {renderField(FIELDS.currentLevel)}
            <span className="pet-levels-arrow" aria-hidden="true">→</span>
            {renderField(FIELDS.targetLevel)}
          </div>
          {renderField(FIELDS.totalXp)}
        </div>
        <div className="pet-levels-result">
          <p className="pet-xp-needed" role="status">
            {xp === undefined ? (
              <><span>XP nécessaire</span><b>—</b></>
            ) : xp > 0 ? (
              <><span>XP nécessaire</span><b>{numberFormat.format(xp)} XP</b></>
            ) : (
              'Aucune XP à donner : le niveau visé est déjà atteint.'
            )}
          </p>
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
        </div>
      </section>

      {plan && plan.xpNeeded > 0 && (
        <section className="panel profit-panel">
          <h2>{sort.key === 'total' && sort.direction === 'asc' && !normalizedQuery ? 'Ressources les moins chères' : 'Ressources'}</h2>
          {!serverId ? (
            <EmptyState icon="coins" title="Aucun serveur choisi" description="Choisissez un serveur pour voir le prix des ressources." />
          ) : status === 'loading' ? (
            <p className="empty" role="status">Chargement des prix…</p>
          ) : !hasAnyPrice && communityUnavailable ? (
            // An unreachable service is not « no price »: it says so and offers to ask again.
            <div role="alert">
              <EmptyState icon="info" title="Prix partagés indisponibles" description="Le service des prix partagés ne répond pas pour le moment.">
                <button type="button" className="btn btn-primary" onClick={() => setAttempt((count) => count + 1)}>Réessayer</button>
              </EmptyState>
            </div>
          ) : !hasAnyPrice ? (
            <EmptyState
              icon="coins"
              title="Aucune recommandation sans prix"
              description="Saisissez le prix de ces ressources dans la page HDV, onglet Animaux, pour voir les moins chères."
            >
              <Link to={ROUTES.hdv} className="btn btn-primary">Saisir des prix dans la page HDV</Link>
            </EmptyState>
          ) : (
            <>
              {communityUnavailable && (
                <p className="sync-status sync-status-offline" role="status">
                  Prix partagés indisponibles : les prix gardés sur cet appareil sont affichés.
                </p>
              )}
              <div className="profit-toolbar">
                <div className="search-input-wrap prices-search">
                  <Icon name="search" size={18} className="search-input-icon" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      resetShown();
                    }}
                    placeholder="Rechercher une ressource..."
                    aria-label="Rechercher une ressource"
                  />
                </div>
                <label className="pet-max-quantity">
                  <span>Quantité max</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={maxQuantityText}
                    placeholder="Aucune"
                    aria-invalid={maxQuantityValid ? undefined : true}
                    aria-describedby={maxQuantityValid ? undefined : 'pet-max-quantity-error'}
                    onChange={(event) => changeMaxQuantity(event.target.value)}
                  />
                </label>
                {!maxQuantityValid && (
                  <p id="pet-max-quantity-error" className="pet-max-quantity-note field-status--error" role="alert">Nombre entier supérieur à 0.</p>
                )}
                {capped.hiddenCount > 0 && maxQuantity !== undefined && (
                  <p className="pet-max-quantity-note">
                    {numberFormat.format(capped.hiddenCount)} {capped.hiddenCount === 1 ? 'ressource masquée' : 'ressources masquées'} (plus de {numberFormat.format(maxQuantity)} unités)
                  </p>
                )}
              </div>
              {plan.recommendations.length === 0 ? (
                <EmptyState
                  icon="search"
                  title="Aucune ressource avec un prix ne correspond"
                  description={foods.length > 0
                    ? `${numberFormat.format(foods.length)} ${foods.length === 1 ? 'ressource correspond' : 'ressources correspondent'}, mais sans prix connu.`
                    : 'Essayez un autre nom de ressource.'}
                />
              ) : capped.shown.length === 0 ? (
                <EmptyState
                  icon="search"
                  title={`Toutes les ressources demandent plus de ${numberFormat.format(maxQuantity ?? 0)} unités`}
                  description="Augmentez la quantité max, ou videz le champ pour toutes les voir."
                />
              ) : (
                <>
                  <SortHeader sort={sort} onSort={(next) => {
                    setSort(next);
                    resetShown();
                  }} />
                  <ul className="profit-list">
                    {visible.map((line) => <FoodLine key={line.food.itemId} line={line} />)}
                  </ul>
                  {visible.length < capped.shown.length && (
                    <div ref={endRef} className="profit-list-end" role="status">
                      {loadingMore && 'Chargement…'}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}
      <BackToTopButton />
    </>
  );
}
