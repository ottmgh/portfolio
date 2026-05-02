# Ottavia Farchi Portfolio

Static Astro portfolio site managed with Bun, edited through Pages CMS, and deployed as static assets on Cloudflare Workers.

## Commands

- `bun install`
- `bun run dev`
- `bun run build`
- `bun run preview`
- `bun run check`
- `bun run deploy`
- `bun run astro ...`

## Content

- Homepage settings: `src/content/site/home.yml`
- About page settings: `src/content/site/about.yml`
- Project entries: `src/content/projects/*.md`
- PagesCMS config: `.pages.yml`
- Public media: `public/media`

## Editing with Pages CMS

- Use **Pages** for homepage and about-page copy.
- Use **Work > Projects** for portfolio entries.
- Project URLs are generated from the Markdown filename. Pages CMS creates that filename from the project title when the entry is first created.
- Keep project display order values unique. Lower numbers appear first.
- Upload/select media through the Pages CMS media library so content stores `/media/...` URLs.

## Notes

- Homepage route: `/`
- About route: `/about/`
- Project page route: `/projects/untitled-i/`
- Media paths in content should use Pages CMS-managed `/media/...` URLs
- Cloudflare deploys the generated `dist/` directory as static assets via `wrangler deploy`
