import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from '@/App';
import { projectName } from '@/project';

describe('the desktop application', () => {
  it('renders the real React application with the configured identity and accessible entry point', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain(`<h1 id="project-title">${projectName}</h1>`);
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('<main id="main-content"');
  });
});
