import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { PROJECT_SLUG_PATTERN } from './lib/portfolio-model';

const site = defineCollection({
  loader: glob({ base: './src/content/site', pattern: 'site.{yml,yaml}' }),
  schema: z.object({
    siteTitle: z.string(),
    siteDescription: z.string(),
    ogImage: z.string().optional().default('')
  })
});

const home = defineCollection({
  loader: glob({ base: './src/content/site', pattern: 'home.{yml,yaml}' }),
  schema: z.object({
    artistName: z.string(),
    artistSubtitle: z.string(),
    introVideo: z.string().optional().default(''),
    skipLabel: z.string(),
    ogImage: z.string().optional().default('')
  })
});

const about = defineCollection({
  loader: glob({ base: './src/content/site', pattern: 'about.md' }),
  schema: z.object({
    summary: z.string()
  })
});

const categories = defineCollection({
  loader: glob({ base: './src/content/categories', pattern: '**/*.{yml,yaml}' }),
  schema: z.object({
    name: z.string(),
    label: z.string()
  })
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    slug: z.string().regex(PROJECT_SLUG_PATTERN),
    year: z.number().int(),
    category: z.string(),
    featured: z.boolean().optional().default(true),
    summary: z.string(),
    video: z.string().optional().default(''),
    ogImage: z.string().optional().default('')
  })
});

export const collections = { site, home, about, categories, projects };
