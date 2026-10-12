import { useActiveServer } from '../../app/ServerContext';
import { SERVER_TYPE_LABELS, groupServersByType } from '../../domain/servers';

export function ServerOnboarding() {
  const { servers, selectServer } = useActiveServer();
  const groups = groupServersByType(servers);

  return (
    <main className="server-onboarding" aria-labelledby="server-onboarding-heading">
      <div className="server-onboarding-card">
        <span className="server-onboarding-brand" aria-hidden="true">
          Dofus<span className="app-nav-brand-accent">Craft</span>
        </span>
        <h1 id="server-onboarding-heading">Choisissez votre serveur</h1>
        <p>
          Dofus Craft calcule si un craft est rentable : coût de fabrication contre prix à l'hôtel des ventes.
          Choisissez votre serveur pour commencer, les prix sont propres à chacun.
        </p>
        {groups.map((group) => (
          <section key={group.type} className="server-onboarding-group">
            <h3 className="eyebrow">{SERVER_TYPE_LABELS[group.type]}</h3>
            <ul className="server-onboarding-list">
              {group.servers.map((server) => (
                <li key={server.id}>
                  <button
                    type="button"
                    className="btn btn-secondary server-onboarding-option"
                    onClick={() => selectServer(server.id)}
                  >
                    {server.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
