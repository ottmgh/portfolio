import { getCollection, getEntry } from 'astro:content';
import { PROJECT_CATEGORIES, PROJECT_SLUG_PATTERN, type ProjectCategory, isProjectCategory } from './portfolio-model';

const CATEGORY_BRANCHES = [
  { id: 'films', label: 'Films', angle: -60, distance: 180, category: 'Film' },
  { id: 'docs', label: 'Documentaries', angle: 0, distance: 200, category: 'Documentary' },
  { id: 'shorts', label: 'Short Films', angle: 60, distance: 180, category: 'Short Film' },
  { id: 'experimental', label: 'Experimental', angle: 140, distance: 190, category: 'Experimental' }
] as const;

const ABOUT_BRANCH = {
  id: 'about',
  label: 'About',
  angle: -140,
  distance: 170,
  href: '/about/'
} as const;

async function loadProjects() {
  return getCollection('projects');
}

type ProjectEntries = Awaited<ReturnType<typeof loadProjects>>;
type ProjectEntry = ProjectEntries[number];

export interface PortfolioProject {
  id: string;
  title: string;
  slug: string;
  href: string;
  order: number;
  year: number;
  category: ProjectCategory;
  description: string;
  video?: string;
}

function createEmptyProjectGroups() {
  return PROJECT_CATEGORIES.reduce(
    (groups, category) => {
      groups[category] = [];
      return groups;
    },
    {} as Record<ProjectCategory, PortfolioProject[]>
  );
}

function requireEntry<T>(
  entry: T | undefined,
  collectionName: string,
  filePath: string
) {
  if (!entry) {
    throw new Error(`Missing required ${collectionName} content entry in ${filePath}`);
  }

  return entry;
}

function validateUniqueProjects<T>(
  projects: ProjectEntries,
  label: string,
  getValue: (project: ProjectEntry) => T
) {
  const seen = new Map<string, string>();

  for (const project of projects) {
    const value = String(getValue(project));
    const previous = seen.get(value);

    if (previous) {
      throw new Error(`Duplicate project ${label} "${value}" in "${previous}" and "${project.id}"`);
    }

    seen.set(value, project.id);
  }
}

function validateProjects(projects: ProjectEntries) {
  validateUniqueProjects(projects, 'order', (project) => project.data.order);
  validateUniqueProjects(projects, 'slug', getProjectSlug);

  for (const project of projects) {
    if (!isProjectCategory(project.data.category)) {
      throw new Error(`Unsupported category "${project.data.category}" in "${project.id}"`);
    }

    const slug = getProjectSlug(project);
    if (!PROJECT_SLUG_PATTERN.test(slug)) {
      throw new Error(`Project filename "${project.id}" must resolve to a lowercase URL slug`);
    }
  }
}

function getProjectSlug(project: ProjectEntry) {
  return project.id.split('/').pop()?.replace(/\.[^.]+$/, '') ?? project.id;
}

function toPortfolioProject(project: ProjectEntry): PortfolioProject {
  const slug = getProjectSlug(project);

  return {
    id: project.id,
    title: project.data.title,
    slug,
    href: `/projects/${slug}/`,
    order: project.data.order,
    year: project.data.year,
    category: project.data.category,
    description: project.data.description,
    video: project.data.video
  };
}

export async function getPortfolioContent() {
  const homeEntry = requireEntry(await getEntry('home', 'home'), 'home', 'src/content/site/home.yml');
  const aboutEntry = requireEntry(
    await getEntry('about', 'about'),
    'about',
    'src/content/site/about.yml'
  );
  const projectEntries = await loadProjects();

  validateProjects(projectEntries);

  return {
    home: homeEntry.data,
    about: aboutEntry.data,
    projects: projectEntries
      .map(toPortfolioProject)
      .sort((left, right) => left.order - right.order)
  };
}

export function getHomepageBranches(
  projects: Awaited<ReturnType<typeof getPortfolioContent>>['projects']
) {
  const groupedProjects = projects.reduce<Record<ProjectCategory, typeof projects>>(
    (groups, project) => {
      groups[project.category].push(project);
      return groups;
    },
    createEmptyProjectGroups()
  );

  return [
    ...CATEGORY_BRANCHES.map((branch) => ({
      ...branch,
      type: 'category' as const,
      children: (groupedProjects[branch.category] ?? []).map((project) => ({
        id: project.id,
        label: project.title,
        href: project.href
      }))
    })),
    {
      ...ABOUT_BRANCH,
      type: 'link' as const
    }
  ];
}
