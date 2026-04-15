import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const home = defineCollection({
  loader: glob({ base: './src/content/site', pattern: 'home.{yml,yaml}' }),
  schema: z.object({
    siteTitle: z.string(),
    metaDescription: z.string(),
    artistName: z.string(),
    artistSubtitle: z.string(),
    introVideo: z.string(),
    skipLabel: z.string(),
    hintText: z.string(),
    ogImage: z.string().optional()
  })
});

const about = defineCollection({
  loader: glob({ base: './src/content/site', pattern: 'about.{yml,yaml}' }),
  schema: z.object({
    title: z.string(),
    intro: z.string(),
    body: z.string()
  })
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must use lowercase letters, numbers, and hyphens'),
    order: z.number().int(),
    year: z.number().int(),
    category: z.enum(['Film', 'Documentary', 'Short Film', 'Experimental']),
    description: z.string(),
    video: z.string().optional()
  })
});

export const collections = { home, about, projects };
