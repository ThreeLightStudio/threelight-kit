import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from '@/App';
import { projectName } from '@/project';

describe('the web application', () => {
  it('renders the actual project and API connection status', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain(`<h1 id="project-title">${projectName}</h1>`);
    expect(html).toContain('Connecting to the API');
    expect(html).toContain('role="status"');
    expect(html).toContain('href="#main-content"');
  });
});
