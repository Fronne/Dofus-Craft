import { useActiveServer } from '../../app/ServerContext';

export function ServerOnboarding() {
  const { servers, selectServer } = useActiveServer();

  return (
    <main className="server-onboarding" aria-labelledby="server-onboarding-heading">
      <div className="server-onboarding-card">
        <span className="server-onboarding-brand" aria-hidden="true">
          Dofus<span className="app-nav-brand-accent">Craft</span>
        </span>
        <h2 id="server-onboarding-heading">Choisissez votre serveur</h2>
        <p>Sélectionnez votre serveur Dofus pour commencer à utiliser Dofus Craft.</p>
        <ul className="server-onboarding-list">
          {servers.map((server) => (
            <li key={server.id}>
              <button type="button" className="btn btn-secondary server-onboarding-option" onClick={() => selectServer(server.id)}>
                {server.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
