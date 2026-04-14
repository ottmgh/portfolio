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
    artistSubtitle: z.string(),
    introVideo: z.string(),
    skipLabel: z.string(),
    hintText: z.string(),
    ogImage: z.string().optional()
  })
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: z.object({
    projectId: z.number().int(),
    title: z.string(),
    year: z.number().int(),
    category: z.enum(['Film', 'Documentary', 'Short Film', 'Experimental']),
    description: z.string(),
    format: z.string().optional(),
    duration: z.string().optional(),
    video: z.string().optional(),
    status: z.string().optional()
  })
});

export const collections = { home, projects };
