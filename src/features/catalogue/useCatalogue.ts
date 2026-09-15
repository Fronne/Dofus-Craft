import { useEffect, useState } from 'react';
import { getCategories, getItemDetail, preloadCatalogueIndexes, searchItems } from '../../data/catalogue-repository';
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
  useEffect(() => {
    getCategories().then(setCategories).catch(() => setCategories([]));
    preloadCatalogueIndexes();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      searchItems(query, categoryId, 0, resultLimit, controller.signal, levelFilter)
        .then((page) => {
          setItems(page.data);
          setTotal(page.total);
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return;
          setItems([]);
          setTotal(0);
          setError(reason instanceof Error ? reason.message : 'Impossible de charger les objets.');
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, categoryId, levelFilter, resultLimit]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(undefined);
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError('');
    getItemDetail(selectedId, controller.signal)
      .then(setDetail)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setDetail(undefined);
        setDetailError(reason instanceof Error ? reason.message : 'Impossible de charger la recette.');
      })
      .finally(() => setDetailLoading(false));
    return () => controller.abort();
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
  };
}
