type DemoApp = {
  name: string;
  description: string;
  href: string;
};

const deployMode = import.meta.env.MODE;

const demoApps: DemoApp[] = [
  {
    name: "Movies DB",
    description: "React 19 + Query + RSC worker transport",
    href: "/movies-db/",
  },
  {
    name: "Monitoring Dashboard",
    description: "Realtime dashboard, TanStack Router, service worker",
    href: "/monitoring-dashboard/",
  },
];

export function App() {
  return (
    <main className="page">
      <div className="grain" aria-hidden="true" />
      <header className="hero">
        <p className="kicker">React 19 Query Demo</p>
        <h1>Example Apps Directory</h1>
        <p className="subtitle">
          One landing deployment, multiple example app deployments. Use this hub to jump between
          demos.
        </p>
      </header>

      <section className="cards" aria-label="Example apps">
        {demoApps.map((app, index) => (
          <a
            key={app.name}
            className="card"
            href={app.href}
            target={app.href.startsWith("http") ? "_blank" : undefined}
            rel={app.href.startsWith("http") ? "noreferrer" : undefined}
            style={{ animationDelay: `${120 * (index + 1)}ms` }}
          >
            <span className="tag">Example</span>
            <h2>{app.name}</h2>
            <p>{app.description}</p>
            <span className="cta">Open app</span>
          </a>
        ))}
      </section>

      <footer className="footer">
        <p>Build mode: {deployMode}</p>
      </footer>
    </main>
  );
}
