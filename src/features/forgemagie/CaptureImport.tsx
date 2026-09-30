import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import {
  normalizeItemName, unitPriceKamas, type FmMe, type PriceableResource, type ProposedLine, type ResourceNameIndex,
} from '../../domain/forgemagie';
import { formatKamas, parseKamas } from '../../domain/kamas';
import { computeDeviationPercent, OUTLIER_THRESHOLD_PERCENT } from '../../domain/outlier-threshold';
import type { PriceMode } from '../../domain/price-modes';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import { loadResourceIndex, readCapture, type CaptureReading } from '../../services/capture-ocr';
import { getCommunityPrices } from '../../services/community-price-api';
import { importFmCapture } from '../../services/fm-api';
import { useOutlierConfirm } from '../comparison/OutlierConfirmDialog';

// specs/025-rune-purchase-import (US5): paste or drop a chat capture, check and correct what was read on
// this device, then validate. Nothing is recorded before « Valider » (FR-023), and a line whose
// resource isn't identified can't be validated (FR-024).

type EditableLine = {
  key: number;
  itemName: string;
  resource: PriceableResource | null;
  quantity: string;
  total: string;
  keep: boolean;
};

const READING_MESSAGES: Record<Exclude<CaptureReading['status'], 'ok'>, string> = {
  'no-lines': 'Aucune ligne d’achat n’a été lue sur cette capture.',
  'not-an-image': 'Ce fichier n’est pas une image.',
  unavailable: 'La lecture de la capture est indisponible pour le moment. Réessaie plus tard.',
};

const toEditable = (line: ProposedLine, key: number): EditableLine => ({
  key,
  itemName: line.itemName,
  resource: line.resource,
  quantity: String(line.quantity),
  total: String(line.totalKamas),
  keep: true,
});

function lineValues(line: EditableLine) {
  const quantity = parseKamas(line.quantity);
  const totalKamas = parseKamas(line.total);
  const valid = quantity !== undefined && quantity > 0 && totalKamas !== undefined && totalKamas > 0;
  return valid ? { quantity, totalKamas, unit: unitPriceKamas({ quantity, totalKamas }) } : undefined;
}

export function CaptureImport({ me, priceMode, onImported }: { me: FmMe; priceMode: PriceMode; onImported: () => void }) {
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [status, setStatus] = useState<'idle' | 'reading' | 'review' | 'saving'>('idle');
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | undefined>(undefined);
  const [index, setIndex] = useState<ResourceNameIndex | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [outlierDialog, confirmOutlier] = useOutlierConfirm();

  useEffect(() => {
    void loadResourceIndex().then(setIndex).catch(() => undefined);
  }, []);

  const read = useCallback(async (file: Blob) => {
    setStatus('reading');
    setMessage(undefined);
    const reading = await readCapture(file);
    if (reading.status !== 'ok') {
      setStatus('idle');
      setMessage({ tone: 'error', text: READING_MESSAGES[reading.status] });
      return;
    }
    setLines(reading.lines.map(toEditable));
    setStatus('review');
  }, []);

  // Pasting anywhere on the page, as players do right after the screenshot.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const image = [...(event.clipboardData?.items ?? [])].find((item) => item.type.startsWith('image/'))?.getAsFile();
      if (!image || status === 'reading' || status === 'saving') return;
      event.preventDefault();
      void read(image);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [read, status]);

  // About 2 800 names: built once, and only rendered while a line still needs its item chosen.
  const resourceNames = useMemo(() => (
    <datalist id="fm-resource-names">
      {index && [...index.values()].filter((resource): resource is PriceableResource => resource !== null)
        .map((resource) => <option key={resource.id} value={resource.name} />)}
    </datalist>
  ), [index]);

  const update = (key: number, changes: Partial<EditableLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...changes } : line)));

  const kept = lines.filter((line) => line.keep);
  const blocked = kept.some((line) => !line.resource || !lineValues(line));

  const validate = async () => {
    if (blocked || kept.length === 0 || !me.serverId) return;
    setStatus('saving');
    setMessage(undefined);
    const priced = kept.map((line) => ({ line, values: lineValues(line)! }));

    // Mode communautaire: the specs/007 confirmation for a price far from the group's median, before
    // anything is sent. Cancelling records nothing.
    if (priceMode === 'community') {
      const lookup = await getCommunityPrices(priced.map(({ line }) => line.resource!.id), me.serverId);
      const medians = new Map(lookup.status === 'found' ? lookup.prices.map((price) => [price.resourceId, price.medianAmountKamas]) : []);
      for (const { line, values } of priced) {
        const median = medians.get(line.resource!.id);
        if (median === undefined || median === 0) continue;
        const deviationPercent = computeDeviationPercent(values.unit, median);
        if (deviationPercent <= OUTLIER_THRESHOLD_PERCENT) continue;
        if (!(await confirmOutlier({ medianAmountKamas: median, enteredAmountKamas: values.unit, deviationPercent }))) {
          setStatus('review');
          setMessage({ tone: 'info', text: 'Import annulé : rien n’a été enregistré.' });
          return;
        }
      }
    }

    const result = await importFmCapture(priced.map(({ line, values }) => ({
      itemName: line.resource!.name,
      itemId: line.resource!.id,
      quantity: values.quantity,
      totalKamas: values.totalKamas,
    })), priceMode === 'community');

    if (result.status !== 'ok') {
      setStatus('review');
      setMessage({
        tone: 'error',
        text: result.status === 'error' && result.code === 'no-server'
          ? 'Choisis d’abord ton serveur Dofus dans l’onglet Profil.'
          : 'L’import n’a pas pu être enregistré. Réessaie.',
      });
      return;
    }
    // Mode personnel: the prices stay on this device, like a manual entry.
    if (priceMode === 'personal') {
      const carnet = resourcePricesFor('personal');
      await Promise.all(priced.map(({ line, values }) => carnet.save(me.serverId!, line.resource!.id, values.unit)));
    }
    setLines([]);
    setStatus('idle');
    setMessage({ tone: 'info', text: `${priced.length} ${priced.length > 1 ? 'achats enregistrés' : 'achat enregistré'}.` });
    onImported();
  };

  return (
    <section className="fm-import" aria-label="Importer une capture du chat">
      <div
        className={`fm-dropzone${dragging ? ' fm-dropzone--active' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) void read(file);
        }}
      >
        <Icon name="image" size={22} />
        <p>
          <b>Coller ou déposer une capture du chat</b> après tes achats à l'HDV.
          {' '}La capture est lue sur ton appareil et n'est jamais envoyée.
        </p>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => fileInput.current?.click()} disabled={status === 'reading' || status === 'saving'}>
          Choisir une image
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void read(file);
          }}
        />
      </div>

      {status === 'reading' && <p className="empty" role="status">Lecture de la capture…</p>}
      {message && <p className={message.tone === 'error' ? 'fm-error' : 'fm-note'} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p>}

      {(status === 'review' || status === 'saving') && lines.length > 0 && (
        <>
          {lines.some((line) => !line.resource) && resourceNames}
          <table className="fm-items fm-import-lines">
            <thead>
              <tr>
                <th scope="col">Garder</th>
                <th scope="col">Objet</th>
                <th scope="col">Quantité</th>
                <th scope="col">Total</th>
                <th scope="col">Prix unitaire</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const values = lineValues(line);
                return (
                  <tr key={line.key} className={line.keep ? undefined : 'fm-line--skipped'}>
                    <td>
                      <input type="checkbox" checked={line.keep} aria-label={`Garder ${line.itemName}`} onChange={(event) => update(line.key, { keep: event.target.checked })} />
                    </td>
                    <th scope="row">
                      {line.resource ? line.resource.name : (
                        <label className="fm-unknown">
                          <span className="fm-error">« {line.itemName} » non reconnu</span>
                          <input
                            list="fm-resource-names"
                            placeholder="Choisir l'objet…"
                            aria-label={`Objet pour « ${line.itemName} »`}
                            onChange={(event) => {
                              const match = index?.get(normalizeItemName(event.target.value));
                              if (match) update(line.key, { resource: match });
                            }}
                          />
                        </label>
                      )}
                    </th>
                    <td>
                      <input className="fm-number" inputMode="numeric" value={line.quantity} aria-label={`Quantité de ${line.itemName}`} onChange={(event) => update(line.key, { quantity: event.target.value })} />
                    </td>
                    <td>
                      <input className="fm-number" inputMode="numeric" value={line.total} aria-label={`Total de ${line.itemName}`} onChange={(event) => update(line.key, { total: event.target.value })} />
                    </td>
                    <td>{values ? `${formatKamas(values.unit)}/u` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="fm-note">Prix unitaire = total ÷ quantité, arrondi au kama le plus proche. Chaque ligne est un lot acheté.</p>
          {blocked && <p className="fm-error" role="alert">Choisis l'objet de chaque ligne non reconnue, ou décoche-la.</p>}
          <div className="fm-import-actions">
            <button type="button" className="btn btn-secondary" onClick={() => { setLines([]); setStatus('idle'); }} disabled={status === 'saving'}>
              Annuler
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void validate()} disabled={blocked || kept.length === 0 || status === 'saving'}>
              {status === 'saving' ? 'Enregistrement…' : 'Valider'}
            </button>
          </div>
        </>
      )}
      {outlierDialog}
    </section>
  );
}
