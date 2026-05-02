// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://ottottx.win',
  trailingSlash: 'always',
  integrations: [sitemap()],

  fonts: [
    {
      name: 'Cormorant Garamond',
      cssVariable: '--font-cormorant-garamond',
      provider: fontProviders.google(),
      weights: [300, 400, 500],
      styles: ['normal', 'italic'],
      subsets: ['latin'],
      fallbacks: ['serif']
    },
    {
      name: 'Space Mono',
      cssVariable: '--font-space-mono',
      provider: fontProviders.google(),
      weights: [400, 700],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['monospace']
    }
  ],

  vite: {
    plugins: [tailwindcss()]
  }
});
