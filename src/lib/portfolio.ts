import { getCollection, getEntry, render } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { ABOUT_BRANCH, PROJECT_SLUG_PATTERN } from './portfolio-model';

type ProjectEntry = CollectionEntry<'projects'>;
type CategoryEntry = CollectionEntry<'categories'>;

export interface PortfolioProject {
  id: string;
  title: string;
  slug: string;
  href: string;
  year: number;
  category: string;
  featured: boolean;
  summary: string;
  video: string;
  ogImage: string;
  Body: Awaited<ReturnType<typeof render>>['Content'];
}

export interface PortfolioCategory {
  name: string;
  label: string;
  angle: number;
  distance: number;
}

function requireEntry<T>(entry: T | undefined, name: string, path: string): T {
  if (!entry) {
    throw new Error(`Missing required content entry "${name}" at ${path}`);
  }

  return entry;
}

function assertUniqueSlugs(projects: ProjectEntry[]) {
  const seen = new Map<string, string>();

  for (const project of projects) {
    const previous = seen.get(project.data.slug);

    if (previous) {
      throw new Error(
        `Duplicate project slug "${project.data.slug}" in "${previous}" and "${project.id}"`
      );
    }

    if (!PROJECT_SLUG_PATTERN.test(project.data.slug)) {
      throw new Error(
        `Project "${project.id}" has invalid slug "${project.data.slug}" — use lowercase letters, numbers, and dashes only`
      );
    }

    seen.set(project.data.slug, project.id);
  }
}

function assertKnownCategories(projects: ProjectEntry[], categories: CategoryEntry[]) {
  const knownCategoryNames = new Set(categories.map((category) => category.data.name));

  for (const project of projects) {
    if (!knownCategoryNames.has(project.data.category)) {
      throw new Error(
        `Project "${project.id}" uses unknown category "${project.data.category}". ` +
          `Add it under Catalog → Categories or update the project.`
      );
    }
  }
}

async function toPortfolioProject(project: ProjectEntry): Promise<PortfolioProject> {
  const { Content } = await render(project);

  return {
    id: project.id,
    title: project.data.title,
    slug: project.data.slug,
    href: `/projects/${project.data.slug}/`,
    year: project.data.year,
    category: project.data.category,
    featured: project.data.featured,
    summary: project.data.summary,
    video: project.data.video,
    ogImage: project.data.ogImage,
    Body: Content
  };
}

function toPortfolioCategory(entry: CategoryEntry): PortfolioCategory {
  return {
    name: entry.data.name,
    label: entry.data.label,
    angle: entry.data.angle,
    distance: entry.data.distance
  };
}

export async function getPortfolioContent() {
  const siteEntry = requireEntry(await getEntry('site', 'site'), 'site', 'src/content/site/site.yml');
  const homeEntry = requireEntry(await getEntry('home', 'home'), 'home', 'src/content/site/home.yml');
  const aboutEntry = requireEntry(await getEntry('about', 'about'), 'about', 'src/content/site/about.md');

  const projectEntries = await getCollection('projects');
  const categoryEntries = await getCollection('categories');

  assertUniqueSlugs(projectEntries);
  assertKnownCategories(projectEntries, categoryEntries);

  const projects = await Promise.all(projectEntries.map(toPortfolioProject));

  projects.sort((left, right) => {
    if (left.year !== right.year) return right.year - left.year;
    return left.title.localeCompare(right.title);
  });

  const categories = categoryEntries.map(toPortfolioCategory);
  const { Content: AboutBody } = await render(aboutEntry);

  return {
    site: siteEntry.data,
    home: homeEntry.data,
    about: { ...aboutEntry.data, Body: AboutBody },
    projects,
    categories
  };
}

export function getHomepageBranches(
  projects: PortfolioProject[],
  categories: PortfolioCategory[]
) {
  const featured = projects.filter((project) => project.featured);

  const categoryBranches = categories.map((category) => ({
    id: `category-${category.name.toLowerCase().replace(/\s+/g, '-')}`,
    type: 'category' as const,
    label: category.label,
    angle: category.angle,
    distance: category.distance,
    children: featured
      .filter((project) => project.category === category.name)
      .map((project) => ({ id: project.id, label: project.title, href: project.href }))
  }));

  return [
    ...categoryBranches,
    {
      id: ABOUT_BRANCH.id,
      type: 'link' as const,
      label: ABOUT_BRANCH.label,
      angle: ABOUT_BRANCH.angle,
      distance: ABOUT_BRANCH.distance,
      href: ABOUT_BRANCH.href
    }
  ];
}
