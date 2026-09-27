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
  planPetFood,
  validatePetLevels,
  xpNeeded,
  xpPerUnit,
  type PetFoodRecommendation,
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

const parse = (text: string) => (text.trim() === '' ? Number.NaN : Number(text));

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
        <b>{numberFormat.format(xpPerUnit(line.food))}</b>
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
  const plan = xp !== undefined ? planPetFood(xp, PET_FOODS, prices) : undefined;
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
                onChange={(event) => setText((current) => ({ ...current, [field.key]: event.target.value }))}
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
          <h2>Ressources les moins chères</h2>
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
              <div className="profit-head pet-food-row" aria-hidden="true">
                <span className="profit-sort">Ressource</span>
                <span className="profit-sort">XP par unité</span>
                <span className="profit-sort">Prix unitaire</span>
                <span className="profit-sort">Quantité</span>
                <span className="profit-sort">Coût total</span>
              </div>
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
                {plan.unpricedCount} {plan.unpricedCount === 1 ? 'ressource sans prix connu n’est pas proposée' : 'ressources sans prix connu ne sont pas proposées'}.
              </p>
              <p>
                XP par ressource et par niveau : <a href={PET_XP_SOURCE.url} target="_blank" rel="noreferrer">{PET_XP_SOURCE.name}</a>
                {' '}(relevé du {new Date(PET_XP_SOURCE.retrievedAt).toLocaleDateString('fr-FR')}). Ces valeurs communautaires peuvent être incomplètes.
              </p>
            </div>
          )}
        </section>
      )}
    </>
  );
}
