export const PROJECT_CATEGORIES = ['Film', 'Documentary', 'Short Film', 'Experimental'] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const PROJECT_SLUG_PATTERN = /^[a-z0-9-]+$/;

export function isProjectCategory(value: string): value is ProjectCategory {
  return PROJECT_CATEGORIES.includes(value as ProjectCategory);
}
