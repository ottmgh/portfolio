import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const home = defineCollection({
  loader: glob({ base: './src/content/site', pattern: '**/*.{yml,yaml}' }),
  schema: z.object({
    siteTitle: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
    artistName: z.string(),
    heroSublabel: z.string(),
    heroVideo: z.string(),
    heroPoster: z.string().optional(),
    homepageProjectLabel: z.string(),
    homepageProjectImage: z.string().optional(),
    ogImage: z.string().optional()
  })
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    year: z.number().int(),
    category: z.string(),
    description: z.string(),
    format: z.string().optional(),
    duration: z.string().optional(),
    sortOrder: z.number().int(),
    video: z.string().optional(),
    status: z.string().optional()
  })
});

export const collections = { home, projects };
