import { projectName } from '@/project';

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header frame">
        <span className="wordmark">{projectName}</span>
        <span className="starter-label">A fresh start</span>
      </header>
      <main id="main-content" className="frame" tabIndex={-1}>
        <section className="hero" aria-labelledby="project-title">
          <div className="hero-copy">
            <p className="eyebrow">React / TypeScript / Vite</p>
            <h1 id="project-title">{projectName}</h1>
            <p className="intro">
              The first screen is yours. Start with one useful idea, and build from here.
            </p>
            <a className="docs-link" href="https://vite.dev/guide/">
              Explore the Vite guide <span aria-hidden="true">↗</span>
            </a>
          </div>
          <aside className="start-card" aria-labelledby="start-title">
            <span className="card-number" aria-hidden="true">
              01
            </span>
            <h2 id="start-title">Make the first change</h2>
            <p>
              Open <code>src/App.tsx</code>, save your edit, and see it here.
            </p>
            <div className="terminal">
              <span className="terminal-label">Local development</span>
              <code>pnpm dev</code>
            </div>
          </aside>
        </section>
        <section className="next-steps" aria-labelledby="next-title">
          <div className="section-heading">
            <p className="eyebrow">A small, solid foundation</p>
            <h2 id="next-title">Keep moving with confidence.</h2>
          </div>
          <ol className="step-list">
            <li>
              <span className="step-number" aria-hidden="true">
                02
              </span>
              <div>
                <h3>Shape your project</h3>
                <p>
                  Add code in <code>src/</code>. Use <code>@/</code> imports to keep paths clear.
                </p>
              </div>
            </li>
            <li>
              <span className="step-number" aria-hidden="true">
                03
              </span>
              <div>
                <h3>Check your work</h3>
                <p>
                  Run <code>pnpm verify</code> for formatting, lint, types, tests, and a build.
                </p>
              </div>
            </li>
            <li>
              <span className="step-number" aria-hidden="true">
                04
              </span>
              <div>
                <h3>See the finished build</h3>
                <p>
                  Run <code>pnpm build</code>, then <code>pnpm preview</code> to review it locally.
                </p>
              </div>
            </li>
          </ol>
        </section>
      </main>
      <footer className="site-footer frame">
        <span>One useful idea at a time.</span>
        <span>Built with ThreeLight Kit</span>
      </footer>
    </>
  );
}
