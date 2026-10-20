import { useCallback, useEffect, useRef, useState } from 'react';
import {
  USAGE_LABELS,
  USAGE_LEVEL_TEXT,
  USAGE_LIMITS,
  USAGE_METRICS,
  USAGE_WINDOWS,
  usageLevel,
  usagePercent,
  type UsageResponse,
  type UsageWindow,
} from '../src/domain/cloudflare-usage';
import { adminApi } from './admin-api';
import { failureMessage } from './messages';
import { UsageChart } from './UsageChart';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'done'; usage: UsageResponse };

const group = new Intl.NumberFormat('fr-FR');
const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

const SECRET_COMMANDS = [
  'npx wrangler secret put CLOUDFLARE_API_TOKEN --config admin-worker/wrangler.toml',
  'npx wrangler secret put CLOUDFLARE_ACCOUNT_ID --config admin-worker/wrangler.toml',
];

// specs/058-admin-cloudflare-usage (contracts/admin-usage-api.md « Interface »): today's consumption against
// the free plan's daily limits, and a 7 / 30 days history. The page never calls Cloudflare itself.
export function CloudflareUsageEditor() {
  const [days, setDays] = useState<UsageWindow>(7);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const read = useCallback(async (period: UsageWindow) => {
    const request = ++latest.current;
    setRefreshing(true);
    const result = await adminApi.getUsage(period);
    if (request !== latest.current) return;
    setRefreshing(false);
    setLoad(result.status === 'ok' ? { state: 'done', usage: result.value } : { state: 'error', message: failureMessage(result) });
  }, []);

  useEffect(() => {
    void read(days);
  }, [days, attempt, read]);

  const usage = load.state === 'done' ? load.usage : undefined;
  const retry = (
    <button type="button" className="btn btn-secondary btn-small" onClick={() => setAttempt((count) => count + 1)}>
      Réessayer
    </button>
  );

  return (
    <section className="panel admin-section" aria-labelledby="admin-usage-title">
      <h2 id="admin-usage-title">Utilisation Cloudflare</h2>
      <p className="settings-section-description">
        Consommation du jour (UTC) face aux limites du plan gratuit, lue chez Cloudflare. Les requêtes Workers comptent tout le compte (site et administration).
      </p>
      {load.state === 'loading' && <p className="empty" role="status">Chargement…</p>}
      {load.state === 'error' && (
        <div className="inline-retry" role="alert">
          <p className="admin-message admin-message--error">{load.message}</p>
          {retry}
        </div>
      )}
      {usage?.state === 'not-configured' && (
        <div className="usage-setup" role="status">
          <p>
            <strong>Jeton Cloudflare non configuré.</strong> Il manque : {usage.missing.length > 0 ? usage.missing.join(', ') : 'le jeton'}.
          </p>
          <p>
            Créez un jeton API en lecture seule (permission « Account Analytics : Read »), relevez l'identifiant du compte, puis enregistrez-les :
          </p>
          <pre>{SECRET_COMMANDS.join('\n')}</pre>
          <p>Détails dans le README, section Administration.</p>
        </div>
      )}
      {usage?.state === 'denied' && (
        <div className="inline-retry" role="alert">
          <p className="admin-message admin-message--error">
            Cloudflare a refusé le jeton : vérifiez qu'il est valide et qu'il a la permission « Account Analytics : Read ».
          </p>
          {retry}
        </div>
      )}
      {usage?.state === 'unavailable' && (
        <div className="inline-retry" role="alert">
          <p className="admin-message admin-message--error">Les chiffres Cloudflare sont indisponibles pour le moment.</p>
          {retry}
        </div>
      )}
      {usage?.state === 'ok' && (
        <>
          <ul className="usage-list">
            {USAGE_METRICS.map((metric) => {
              const used = usage.history[usage.history.length - 1][metric];
              const limit = USAGE_LIMITS[metric];
              const percent = usagePercent(used, limit);
              const level = usageLevel(used, limit);
              return (
                <li key={metric} className={`usage-row usage-row--${level}`}>
                  <div className="usage-row-head">
                    <strong>{USAGE_LABELS[metric]}</strong>
                    <span>{group.format(used)} / {group.format(limit)} · {percent} %</span>
                  </div>
                  <div
                    className="usage-bar"
                    role="progressbar"
                    aria-label={USAGE_LABELS[metric]}
                    aria-valuemin={0}
                    aria-valuemax={limit}
                    aria-valuenow={Math.min(used, limit)}
                    aria-valuetext={`${percent} % de la limite`}
                  >
                    <div className="usage-bar-fill" style={{ width: `${Math.min(percent, 100)}%` }} />
                  </div>
                  <span className="usage-level">{USAGE_LEVEL_TEXT[level]}</span>
                </li>
              );
            })}
          </ul>
          <div className="usage-controls">
            <div role="group" aria-label="Période de l'historique" className="usage-window">
              {USAGE_WINDOWS.map((period) => (
                <button
                  key={period}
                  type="button"
                  className="btn btn-secondary btn-small"
                  aria-pressed={days === period}
                  onClick={() => setDays(period)}
                >
                  {period} jours
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setAttempt((count) => count + 1)}>
              Actualiser
            </button>
            <span className="usage-read-at">Dernière lecture : {timeFormatter.format(new Date(usage.readAt))} UTC</span>
          </div>
          {refreshing && <p className="empty" role="status">Chargement…</p>}
          <UsageChart history={usage.history} />
        </>
      )}
    </section>
  );
}
