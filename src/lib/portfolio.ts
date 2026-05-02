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
  category: PortfolioCategory;
  featured: boolean;
  summary: string;
  video: string;
  videoEmbed: PortfolioVideoEmbed | null;
  ogImage: string;
  Body: Awaited<ReturnType<typeof render>>['Content'];
}

export interface PortfolioVideoEmbed {
  provider: 'youtube' | 'vimeo';
  src: string;
  title: string;
}

export interface PortfolioCategory {
  id: string;
  label: string;
}

function requireEntry<T>(entry: T | undefined, name: string, path: string): T {
  if (!entry) {
    throw new Error(`Missing required content entry "${name}" at ${path}`);
  }

  return entry;
}

const CATEGORY_COLLECTION_PATH = 'src/content/categories';

function getProjectSlug(project: ProjectEntry) {
  return project.id;
}

function getCategoryReference(category: CategoryEntry) {
  return `${CATEGORY_COLLECTION_PATH}/${category.id}.yml`;
}

function getYouTubeId(url: URL) {
  if (url.hostname === 'youtu.be') {
    return url.pathname.split('/').filter(Boolean)[0] ?? '';
  }

  if (url.hostname.endsWith('youtube.com') || url.hostname.endsWith('youtube-nocookie.com')) {
    if (url.pathname === '/watch') return url.searchParams.get('v') ?? '';

    const [, videoId] = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/) ?? [];
    return videoId ?? '';
  }

  return '';
}

function getVimeoEmbed(url: URL) {
  if (!url.hostname.endsWith('vimeo.com')) return null;

  if (url.hostname === 'player.vimeo.com') {
    const [, videoId] = url.pathname.match(/^\/video\/(\d+)/) ?? [];
    return videoId ? url : null;
  }

  const [videoId, privacyHash] = url.pathname.split('/').filter(Boolean);
  if (!videoId || !/^\d+$/.test(videoId)) return null;

  const embedUrl = new URL(`https://player.vimeo.com/video/${videoId}`);
  const hash = url.searchParams.get('h') || privacyHash;

  if (hash) {
    embedUrl.searchParams.set('h', hash);
  }

  return embedUrl;
}

function toVideoEmbed(video: string, projectId: string): PortfolioVideoEmbed | null {
  const source = video.trim();

  if (!source) return null;

  let url: URL;

  try {
    url = new URL(source);
  } catch {
    throw new Error(
      `Project "${projectId}" has invalid video URL "${video}". Use a YouTube or Vimeo URL.`
    );
  }

  const youTubeId = getYouTubeId(url);

  if (youTubeId) {
    return {
      provider: 'youtube',
      src: `https://www.youtube-nocookie.com/embed/${youTubeId}`,
      title: 'YouTube video player'
    };
  }

  const vimeoEmbed = getVimeoEmbed(url);

  if (vimeoEmbed) {
    return {
      provider: 'vimeo',
      src: vimeoEmbed.toString(),
      title: 'Vimeo video player'
    };
  }

  throw new Error(
    `Project "${projectId}" has unsupported video URL "${video}". Use a YouTube or Vimeo URL.`
  );
}

function assertUniqueSlugs(projects: ProjectEntry[]) {
  const seen = new Map<string, string>();

  for (const project of projects) {
    const slug = getProjectSlug(project);
    const previous = seen.get(slug);

    if (previous) {
      throw new Error(
        `Duplicate project slug "${slug}" in "${previous}" and "${project.id}"`
      );
    }

    if (!PROJECT_SLUG_PATTERN.test(slug)) {
      throw new Error(
        `Project "${project.id}" has invalid filename-derived slug "${slug}" — use lowercase letters, numbers, and dashes only`
      );
    }

    seen.set(slug, project.id);
  }
}

function assertUniqueCategoryLabels(categories: CategoryEntry[]) {
  const seen = new Map<string, string>();

  for (const category of categories) {
    if (!PROJECT_SLUG_PATTERN.test(category.id)) {
      throw new Error(
        `Category "${category.id}" has invalid filename-derived id — use lowercase letters, numbers, and dashes only`
      );
    }

    const normalizedLabel = category.data.label.trim().toLocaleLowerCase();
    const previous = seen.get(normalizedLabel);

    if (previous) {
      throw new Error(
        `Duplicate category label "${category.data.label}" in "${previous}" and "${category.id}"`
      );
    }

    seen.set(normalizedLabel, category.id);
  }
}

function assertKnownCategories(projects: ProjectEntry[], categories: CategoryEntry[]) {
  const knownCategoryReferences = new Set(categories.map(getCategoryReference));

  for (const project of projects) {
    if (!knownCategoryReferences.has(project.data.category)) {
      throw new Error(
        `Project "${project.id}" uses unknown category "${project.data.category}". ` +
          `Add it under Catalog → Categories or update the project.`
      );
    }
  }
}

async function toPortfolioProject(
  project: ProjectEntry,
  categoriesByReference: Map<string, PortfolioCategory>
): Promise<PortfolioProject> {
  const { Content } = await render(project);
  const slug = getProjectSlug(project);
  const category = categoriesByReference.get(project.data.category);

  if (!category) {
    throw new Error(`Project "${project.id}" uses unknown category "${project.data.category}"`);
  }

  return {
    id: project.id,
    title: project.data.title,
    slug,
    href: `/projects/${slug}/`,
    year: project.data.year,
    category,
    featured: project.data.featured,
    summary: project.data.summary,
    video: project.data.video,
    videoEmbed: toVideoEmbed(project.data.video, project.id),
    ogImage: project.data.ogImage,
    Body: Content
  };
}

function toPortfolioCategory(entry: CategoryEntry): PortfolioCategory {
  return {
    id: entry.id,
    label: entry.data.label
  };
}

function toGraphId(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function getPortfolioContent() {
  const siteEntry = requireEntry(await getEntry('site', 'site'), 'site', 'src/content/site/site.yml');
  const homeEntry = requireEntry(await getEntry('home', 'home'), 'home', 'src/content/site/home.yml');
  const aboutEntry = requireEntry(await getEntry('about', 'about'), 'about', 'src/content/site/about.md');

  const projectEntries = await getCollection('projects');
  const categoryEntries = await getCollection('categories');

  assertUniqueSlugs(projectEntries);
  assertUniqueCategoryLabels(categoryEntries);
  assertKnownCategories(projectEntries, categoryEntries);

  const categories = categoryEntries.map(toPortfolioCategory);
  const categoriesByReference = new Map(
    categoryEntries.map((category) => [getCategoryReference(category), toPortfolioCategory(category)])
  );
  const projects = await Promise.all(
    projectEntries.map((project) => toPortfolioProject(project, categoriesByReference))
  );

  projects.sort((left, right) => {
    if (left.year !== right.year) return right.year - left.year;
    return left.title.localeCompare(right.title);
  });

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
    id: `category-${toGraphId(category.id)}`,
    type: 'category' as const,
    label: category.label,
    children: featured
      .filter((project) => project.category.id === category.id)
      .map((project) => ({ id: project.id, label: project.title, href: project.href }))
  }));

  return [
    ...categoryBranches,
    {
      id: ABOUT_BRANCH.id,
      type: 'link' as const,
      label: ABOUT_BRANCH.label,
      href: ABOUT_BRANCH.href
    }
  ];
}
