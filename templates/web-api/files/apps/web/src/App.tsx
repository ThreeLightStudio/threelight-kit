import { useEffect, useState } from 'react';
import type { HealthResponse } from '@app/contracts';
import { projectName } from '@/project';

type ApiState = { kind: 'loading' } | { kind: 'ready'; health: HealthResponse } | { kind: 'error' };

export default function App() {
  const [api, setApi] = useState<ApiState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    async function checkApi() {
      try {
        const response = await fetch('/api/health', { signal: controller.signal });
        const health: HealthResponse = await response.json();
        if (
          !response.ok ||
          health.ready !== true ||
          typeof health.name !== 'string' ||
          typeof health.version !== 'string'
        ) {
          throw new Error('Unexpected API health response');
        }
        if (!controller.signal.aborted) setApi({ kind: 'ready', health });
      } catch {
        if (!controller.signal.aborted) setApi({ kind: 'error' });
      }
    }
    void checkApi();
    return () => controller.abort();
  }, []);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header frame">
        <span className="wordmark">{projectName}</span>
        <span>Web + API starter</span>
      </header>
      <main id="main-content" className="frame" tabIndex={-1}>
        <section className="hero" aria-labelledby="project-title">
          <p className="eyebrow">Two parts. One starting point.</p>
          <h1 id="project-title">{projectName}</h1>
          <p className="intro">
            Your web app and API are connected. Build one useful idea from here.
          </p>
          <div className={`health-panel health-${api.kind}`} role="status" aria-live="polite">
            <span className="status-dot" aria-hidden="true" />
            <div>
              <h2>
                {api.kind === 'ready'
                  ? 'API ready'
                  : api.kind === 'error'
                    ? 'API unavailable'
                    : 'Connecting to the API'}
              </h2>
              <p>
                {api.kind === 'ready'
                  ? `${api.health.name} · v${api.health.version}`
                  : api.kind === 'error'
                    ? 'Check the terminal output, then reload this page.'
                    : 'Checking /api/health…'}
              </p>
            </div>
          </div>
        </section>
        <section className="next-steps" aria-labelledby="next-title">
          <h2 id="next-title">Make the first change.</h2>
          <ol className="step-list">
            <li>
              <h3>Shape the screen</h3>
              <p>
                Edit <code>apps/web/src/App.tsx</code>. Vite updates the page as you save.
              </p>
            </li>
            <li>
              <h3>Add your API</h3>
              <p>
                Start in <code>apps/server/src/app.ts</code>. Restart <code>pnpm dev</code> after
                server changes.
              </p>
            </li>
            <li>
              <h3>Check both parts</h3>
              <p>
                Run <code>pnpm verify</code>, then <code>pnpm start</code> to preview the finished
                app.
              </p>
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
