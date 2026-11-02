import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { PriceMode } from '../../domain/price-modes';
import { searchTourSteps, type TourStep } from '../onboarding/search-tour-steps';
import { hasSeenSearchTour, markSearchTourSeen } from '../../persistence/search-tour-preference';

export function useRechercheTour({ priceMode, firstCraftablePath, expandedPaths, setExpandedPaths }: {
  priceMode: PriceMode;
  firstCraftablePath: string | undefined;
  expandedPaths: ReadonlySet<string>;
  setExpandedPaths: Dispatch<SetStateAction<ReadonlySet<string>>>;
}) {
  // specs/011-search-onboarding: the guided tour starts on its own until it has been finished or
  // dismissed once on this device (FR-001), and the help button reopens it at step 1 (FR-007).
  // Leaving the page mid-tour unmounts it without marking it seen (research.md §5).
  const [tourOpen, setTourOpen] = useState(() => !hasSeenSearchTour());
  const tourSteps = useMemo(() => searchTourSteps(priceMode), [priceMode]);
  // The line the tour unfolded itself (never one the player had unfolded), folded back afterwards.
  const tourUnfoldedPath = useRef<string | undefined>(undefined);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const foldTourUnfolded = () => {
    const path = tourUnfoldedPath.current;
    if (!path) return;
    tourUnfoldedPath.current = undefined;
    setExpandedPaths((current) => {
      const next = new Set(current);
      next.delete(path);
      return next;
    });
  };
  const onTourStepChange = (step: TourStep) => {
    if (step.id !== 'intermediate') {
      foldTourUnfolded();
      return;
    }
    if (!firstCraftablePath || expandedPaths.has(firstCraftablePath)) return;
    tourUnfoldedPath.current = firstCraftablePath;
    setExpandedPaths((current) => new Set(current).add(firstCraftablePath));
  };
  const onTourClose = () => {
    foldTourUnfolded();
    markSearchTourSeen();
    setTourOpen(false);
    // Back to where the tour is opened from, instead of the top of the document.
    helpButtonRef.current?.focus();
  };

  return { tourOpen, openTour: () => setTourOpen(true), tourSteps, helpButtonRef, onTourStepChange, onTourClose };
}
