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

## Content layout

| Pages CMS section | File on disk | What it is |
| --- | --- | --- |
| Site settings → Site | `src/content/site/site.yml` | Site title, default meta description, default social-preview image |
| Pages → Homepage | `src/content/site/home.yml` | Artist name, intro video, homepage-only social preview |
| Pages → About | `src/content/site/about.md` | About page summary + body (Markdown) |
| Catalog → Projects | `src/content/projects/*.md` | One Markdown file per project (frontmatter + body) |
| Catalog → Categories | `src/content/categories/*.yml` | One YAML file per category that appears on the homepage tree |
| Public media | `public/media/images`, `public/media/videos` | Image uploads and the homepage intro video upload from Pages CMS |

## Editing notes

- **Site settings** edits the values used across every page (browser title, fallback meta description, fallback OG image).
- **Pages → Homepage** controls the homepage tree only (artist name and intro video).
- **Pages → About** has a short Summary used for SEO and a rich-text Body shown on the page.
- **Catalog → Projects** entries have a `slug` field that controls the URL (`/projects/<slug>/`). Change the slug to change the URL.
- **Catalog → Categories** drives the homepage branches. Editors only set the visible category label; projects store a stable reference to the category file behind the scenes. To add a new category: create one here, then assign it to a project; it will appear on the homepage automatically.
- A project shows on the homepage tree when **Show on homepage tree** is enabled. Projects are sorted by year (newest first), then alphabetically.
- Project videos use YouTube or Vimeo URLs and are rendered as embedded players. Keep local video uploads for the homepage intro only.
- Each page can override the social-preview image; otherwise the site default is used.
- The About branch is hardcoded into the homepage layout — it is not edited through the CMS.

## Routes

- `/` — homepage tree
- `/about/` — About page
- `/projects/<slug>/` — one page per project, slug taken from the project's `slug` field

Cloudflare deploys the generated `dist/` directory as static assets via `wrangler deploy`.
