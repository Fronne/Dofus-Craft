import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemDetail } from '../../src/features/catalogue/ItemDetail';
import { ResourcePriceInput } from '../../src/features/comparison/ResourcePriceInput';
import { parseKamas } from '../../src/domain/kamas';

describe('ItemDetail recipe resources', () => {
  it('shows each resource image and quantity', () => {
    const { container } = render(
      <ItemDetail
        detail={{
          item: {
            id: '1',
            name: 'Amulette du Bouftou',
            kind: 'Equipment',
            categoryId: 'equipment-type-1',
          },
          recipe: {
            id: 'recipe-1',
            itemId: '1',
            ingredients: [
              { resourceId: '10', quantity: 10 },
              { resourceId: '11', quantity: 5 },
            ],
          },
          resources: [
            { id: '10', name: 'Bois de Frêne', imageUrl: 'https://api.dofusdb.fr/img/items/10.png' },
            { id: '11', name: 'Fer', imageUrl: 'https://api.dofusdb.fr/img/items/11.png' },
          ],
        }}
      />,
    );

    expect(screen.getByText('Bois de Frêne × 10')).toBeInTheDocument();
    expect(screen.getByText('Fer × 5')).toBeInTheDocument();
    expect(container.querySelector('li img')).toHaveAttribute(
      'src',
      'https://api.dofusdb.fr/img/items/10.png',
    );
  });

  it('shows DofusDB-provided item statistics before the recipe', () => {
    render(
      <ItemDetail
        detail={{
          item: { id: '1', name: 'Trophée', kind: 'Equipment', categoryId: 'equipment-type-151' },
          stats: [{ id: '125-0', label: '10 à 20 Vitalité' }],
          recipe: { id: 'recipe-1', itemId: '1', ingredients: [{ resourceId: '10', quantity: 1 }] },
          resources: [{ id: '10', name: 'Fer' }],
        }}
      />,
    );

    expect(screen.getAllByRole('heading', { name: 'Statistiques' }).at(-1)).toBeInTheDocument();
    expect(screen.getByText('10 à 20 Vitalité')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Recette' }).at(-1)).toBeInTheDocument();
  });

  it('shows the panoplie below the item name and provenance after the recipe', () => {
    render(
      <ItemDetail
        detail={{
          item: { id: '14094', name: 'Amulette du Strigide', level: 200, kind: 'Equipment', categoryId: 'equipment-type-1' },
          category: { id: 'equipment-type-1', label: 'Amulette', kind: 'Equipment', sortOrder: 1, typeIds: [1] },
          panoplieName: 'Panoplie du Strigide',
          recipe: { id: 'recipe-14094', itemId: '14094', ingredients: [{ resourceId: '10', quantity: 2 }] },
          resources: [{ id: '10', name: 'Ressource de test' }],
        }}
      />,
    );

    const panoplie = screen.getByText('Panoplie : Panoplie du Strigide');
    expect(panoplie).toHaveClass('item-set-name');
    expect(panoplie).toBeInTheDocument();
    expect(panoplie).toHaveTextContent('Panoplie : Panoplie du Strigide');
    expect(screen.getByText('Niveau : 200')).toBeInTheDocument();
    expect(screen.getByText('Catégorie : Amulette')).toBeInTheDocument();
    const provenanceHeading = screen.getAllByRole('heading', { name: 'Informations DofusDB' }).at(-1)!;
    const statsHeading = screen.getAllByRole('heading', { name: 'Statistiques' }).at(-1)!;
    expect(provenanceHeading).toBeInTheDocument();
    expect(panoplie.compareDocumentPosition(statsHeading))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getAllByRole('heading', { name: 'Recette' }).at(-1)!.compareDocumentPosition(
      provenanceHeading,
    )).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('does not render a panoplie label when the item has no set relation', () => {
    const { container } = render(
      <ItemDetail
        detail={{
          item: { id: '1', name: 'Objet isolé', kind: 'Equipment', categoryId: 'equipment-type-1' },
          resources: [],
        }}
      />,
    );

    expect(container.querySelector('.item-set-name')).not.toBeInTheDocument();
  });

  it('offers pin and unpin actions for the selected item', () => {
    const onTogglePin = vi.fn();
    const detail = {
      item: { id: '1', name: 'Objet épinglable', kind: 'Equipment' as const, categoryId: 'equipment-type-1' },
      resources: [],
    };
    const { rerender } = render(
      <ItemDetail detail={detail} onTogglePin={onTogglePin} />,
    );

    expect(screen.getByRole('button', { name: 'Épingler' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Épingler' }));
    expect(onTogglePin).toHaveBeenCalledOnce();

    rerender(<ItemDetail detail={detail} isPinned onTogglePin={onTogglePin} />);
    expect(screen.getByRole('button', { name: 'Désépingler' })).toBeInTheDocument();
  });

  it('shows the resource image in the price input and keeps formatted values numeric', () => {
    const resource = { id: '10', name: 'Bois de Frêne', imageUrl: 'https://api.dofusdb.fr/img/items/10.png' };
    const { container } = render(
      <ResourcePriceInput
        resource={resource}
        quantity={10}
        value="1000"
        onChange={() => undefined}
      />,
    );

    expect(container.querySelector('input')).toHaveValue('1 000');
    expect(container.querySelector('img')).toHaveAttribute('src', resource.imageUrl);
    expect(parseKamas('1 000')).toBe(1000);
  });

  it('keeps every price row aligned with a fixed resource image area', () => {
    const resource = { id: '10', name: 'Ressource au nom très long', imageUrl: 'https://api.dofusdb.fr/img/items/10.png' };
    const { container } = render(
      <ResourcePriceInput resource={resource} quantity={1} value="1000" onChange={() => undefined} />,
    );

    expect(container.querySelector('.price-resource .resource-display')).toBeInTheDocument();
    expect(container.querySelector('.price-resource img')).toHaveAttribute('width', '32');
    expect(container.querySelector('.price-resource img')).toHaveAttribute('height', '32');
  });

  it('displays resource update dates without seconds', () => {
    render(
      <ResourcePriceInput
        resource={{ id: '10', name: 'Fer' }}
        quantity={1}
        value="100"
        updatedAt="2026-09-13T16:42:37.000Z"
        onChange={() => undefined}
      />,
    );

    expect(screen.getByText(/Dernière mise à jour/)).toHaveTextContent(/16:42/);
    expect(screen.getByText(/Dernière mise à jour/)).not.toHaveTextContent(/16:42:37/);
  });
});
