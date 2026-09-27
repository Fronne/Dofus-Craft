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
import {
  PET_FOODS,
  PET_MAX_LEVEL,
  PET_MIN_LEVEL,
  PET_XP_SOURCE,
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
const FIELDS: { key: Field; label: string; min: number; max?: number }[] = [
  { key: 'currentLevel', label: 'Niveau actuel', min: PET_MIN_LEVEL, max: PET_MAX_LEVEL - 1 },
  { key: 'xpInLevel', label: 'XP déjà gagnée dans ce niveau', min: 0 },
  { key: 'targetLevel', label: 'Niveau visé', min: PET_MIN_LEVEL + 1, max: PET_MAX_LEVEL },
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
  { key: 'xpPerUnit', label: 'XP par unité', first: 'desc' },
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
        <span className="profit-cell-label">XP par unité</span>
        <b>{numberFormat.format(line.food.xpPerUnit)}</b>
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
  const plan = xp !== undefined ? planPetFood(xp, PET_FOODS, prices, MAX_RECOMMENDATIONS, sort) : undefined;
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
            <label key={field.key} className="pet-level-field">
              <span>{field.label}</span>
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
      </section>

      {plan && plan.xpNeeded > 0 && (
        <section className="panel profit-panel">
          <h2>{sort.key === 'total' && sort.direction === 'asc' ? 'Ressources les moins chères' : 'Ressources'}</h2>
          {!serverId ? (
            <EmptyState icon="coins" title="Aucun serveur choisi" description="Choisissez un serveur pour voir le prix des ressources." />
          ) : status === 'loading' ? (
            <p className="empty" role="status">Chargement des prix…</p>
          ) : plan.recommendations.length === 0 ? (
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
              <SortHeader sort={sort} onSort={setSort} />
              <ul className="profit-list">
                {plan.recommendations.map((line) => <FoodLine key={line.food.itemId} line={line} />)}
              </ul>
            </>
          )}
          {status === 'ready' && (
            <div className="pet-food-notes">
              {communityUnavailable && (
                <p className="warning">Prix communautaires indisponibles pour le moment : seuls vos prix sont utilisés.</p>
              )}
              <p>
                {numberFormat.format(plan.unpricedCount)} {plan.unpricedCount === 1 ? 'ressource sans prix connu n’est pas proposée' : 'ressources sans prix connu ne sont pas proposées'}.
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
