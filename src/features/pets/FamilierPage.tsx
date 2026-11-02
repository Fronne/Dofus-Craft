import { BackToTopButton } from '../../components/BackToTopButton';
import type { PriceMode } from '../../domain/price-modes';
import { PET_MIN_LEVEL, petXpProgress } from '../../domain/pet-xp';
import { PetObjectiveBanner } from './PetObjectiveBanner';
import { PetFoodPodium } from './PetFoodPodium';
import { PetFoodTarget } from './PetFoodTarget';
import { PetFoodTable } from './PetFoodTable';
import { petPriceState } from './PetPriceState';
import { FIELDS, withField, type Field } from './pet-level-fields';
import { usePetXpCalculator } from './usePetXpCalculator';

// specs/022-pet-xp-calculator: the XP a pet still needs to reach a level, and the cheapest resources
// to feed it with on the active server, in the active price mode. specs/055-refonte-xp-familier lays
// it out in four blocks: the objective, the podium of the 3 cheapest, one food aimed at, and the table
// of the others with their rank.

// specs/053-hdv-page-toggle: `hdvPageEnabled` false while the owner has the HDV page off, so no
// invitation leads to it.
export function FamilierPage({ priceMode, hdvPageEnabled = true }: { priceMode: PriceMode; hdvPageEnabled?: boolean }) {
  const calc = usePetXpCalculator(priceMode);
  const {
    serverId, serverName, text, setText, sort, setSort, query, setQuery,
    maxQuantity, maxQuantityText, maxQuantityValid, changeMaxQuantity, almanax, setAlmanax,
    levels, errors, xp, fieldErrors, status, prices, communityUnavailable, hasAnyPrice, retryPrices,
    normalizedQuery, foods, xpMultiplier, plan, capped, ranked, podium, rankById, tableLines,
    visible, endRef, loadingMore, resetShown, targetId, setTargetId, targetQuery, setTargetQuery,
  } = calc;
  const modeLabel = priceMode === 'community' ? 'Mode communautaire' : 'Mode personnel';
  const priceState = petPriceState({ serverId, status, hasAnyPrice, communityUnavailable, hdvPageEnabled, onRetry: retryPrices });

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

      <PetObjectiveBanner
        levels={(
          <div className="pet-levels">
            {renderField(FIELDS.currentLevel)}
            <span className="pet-levels-arrow" aria-hidden="true">→</span>
            {renderField(FIELDS.targetLevel)}
          </div>
        )}
        totalXpField={renderField(FIELDS.totalXp)}
        progress={errors.totalXp ? undefined : petXpProgress(levels.totalXp)}
        xp={xp}
        almanax={almanax}
        onAlmanaxChange={setAlmanax}
        onLevelChange={(level) => setText((current) => withField(current, 'currentLevel', String(level)))}
      />

      {plan && plan.xpNeeded > 0 && (
        <>
          {priceState ? (
            <section className="panel">{priceState}</section>
          ) : (
            <>
              {communityUnavailable && (
                <p className="sync-status sync-status-offline" role="status">
                  Prix partagés indisponibles : les prix gardés sur cet appareil sont affichés.
                </p>
              )}
              {podium.length > 0 && <PetFoodPodium entries={podium} />}
            </>
          )}

          <PetFoodTarget
            xp={plan.xpNeeded}
            prices={prices}
            ranked={ranked}
            maxQuantity={maxQuantity}
            xpMultiplier={xpMultiplier}
            selectedId={targetId}
            onSelect={setTargetId}
            query={targetQuery}
            onQueryChange={setTargetQuery}
          />

          {!priceState && (
            <PetFoodTable
              query={query}
              onQueryChange={setQuery}
              resetShown={resetShown}
              sort={sort}
              onSort={setSort}
              maxQuantity={maxQuantity}
              maxQuantityText={maxQuantityText}
              maxQuantityValid={maxQuantityValid}
              onMaxQuantityChange={changeMaxQuantity}
              capped={capped}
              recommendationCount={plan.recommendations.length}
              foodCount={foods.length}
              normalizedQuery={normalizedQuery}
              tableLines={tableLines}
              visible={visible}
              rankById={rankById}
              endRef={endRef}
              loadingMore={loadingMore}
            />
          )}
        </>
      )}
      <BackToTopButton />
    </>
  );
}
