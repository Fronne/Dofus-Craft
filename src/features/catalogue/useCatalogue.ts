import { useEffect, useState } from 'react';
import { getCategories, getItemDetail, searchItems, whenCatalogueReady } from '../../data/catalogue-repository';
import type { Category, Item, ItemStat, Recipe, Resource } from '../../domain/types';

export function useCatalogue(query: string, categoryId: string, selectedId: string, levelFilter = '', resultLimit = 12) {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<{ recipe?: Recipe; resources: Resource[]; stats?: ItemStat[]; panoplieName?: string }>();
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [catalogueWarm, setCatalogueWarm] = useState(false);
  useEffect(() => {
    getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  // The full catalogue loads in the background from app start (see App.tsx). Until it's
  // ready, an unfiltered search only has a small capped preview to work with, so its count
  // isn't the real total yet. Once the background load finishes, force one silent refetch so
  // any view still showing preview-based results picks up the accurate data.
  useEffect(() => {
    let cancelled = false;
    whenCatalogueReady().then(() => {
      if (!cancelled) setCatalogueWarm(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      searchItems(query, categoryId, 0, resultLimit, undefined, levelFilter)
        .then((page) => {
          if (cancelled) return;
          setItems(page.data);
          setTotal(page.total);
        })
        .catch((reason: unknown) => {
          if (cancelled) return;
          setItems([]);
          setTotal(0);
          setError(reason instanceof Error ? reason.message : 'Impossible de charger les objets.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      cancelled = true;
    };
  }, [query, categoryId, levelFilter, resultLimit, catalogueWarm]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(undefined);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError('');
    getItemDetail(selectedId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setDetail(undefined);
        setDetailError(reason instanceof Error ? reason.message : 'Impossible de charger la recette.');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  return {
    items,
    total,
    loading,
    error,
    detail,
    detailLoading,
    detailError,
    categories,
    catalogueWarm,
  };
}
