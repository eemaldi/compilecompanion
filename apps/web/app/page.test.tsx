import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import manifest from './manifest';
import HomePage from './page';

describe('web unit smoke', () => {
  it('renders the home page', () => {
    expect(renderToStaticMarkup(<HomePage />)).toContain('Compile Companion');
  });

  it('declares an installable PWA manifest', () => {
    expect(manifest()).toMatchObject({ display: 'standalone', start_url: '/' });
  });
});
