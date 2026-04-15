import { getCollection } from 'astro:content';

const PROJECT_CATEGORIES = ['Film', 'Documentary', 'Short Film', 'Experimental'] as const;

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

function requireSingleEntry<T>(
  entries: T[],
  collectionName: string,
  filePath: string
) {
  if (entries.length === 0) {
    throw new Error(`Missing required ${collectionName} content entry in ${filePath}`);
  }

  if (entries.length > 1) {
    throw new Error(`Expected exactly one ${collectionName} content entry in ${filePath}`);
  }

  return entries[0];
}

function validateUniqueProjects(
  projects: ProjectEntries,
  key: 'slug' | 'order'
) {
  const seen = new Map<string, string>();

  for (const project of projects) {
    const value = String(project.data[key]);
    const previous = seen.get(value);

    if (previous) {
      throw new Error(`Duplicate project ${key} "${value}" in "${previous}" and "${project.id}"`);
    }

    seen.set(value, project.id);
  }
}

function validateProjects(projects: ProjectEntries) {
  validateUniqueProjects(projects, 'slug');
  validateUniqueProjects(projects, 'order');

  for (const project of projects) {
    if (!PROJECT_CATEGORIES.includes(project.data.category)) {
      throw new Error(`Unsupported category "${project.data.category}" in "${project.id}"`);
    }

    const filename = project.id.split('/').pop()?.replace(/\.[^.]+$/, '') ?? project.id;
    if (filename !== project.data.slug) {
      throw new Error(
        `Project slug "${project.data.slug}" must match filename "${filename}" for "${project.id}"`
      );
    }
  }
}

export async function getPortfolioContent() {
  const homeEntry = requireSingleEntry(await getCollection('home'), 'home', 'src/content/site/home.yml');
  const aboutEntry = requireSingleEntry(
    await getCollection('about'),
    'about',
    'src/content/site/about.yml'
  );
  const projects = await loadProjects();

  validateProjects(projects);

  return {
    home: homeEntry.data,
    about: aboutEntry.data,
    projects: projects.sort((left, right) => left.data.order - right.data.order)
  };
}

export function getHomepageBranches(
  projects: Awaited<ReturnType<typeof getPortfolioContent>>['projects']
) {
  const groupedProjects = projects.reduce<Record<(typeof PROJECT_CATEGORIES)[number], typeof projects>>(
    (groups, project) => {
      groups[project.data.category].push(project);
      return groups;
    },
    {
      Film: [],
      Documentary: [],
      'Short Film': [],
      Experimental: []
    }
  );

  return [
    ...CATEGORY_BRANCHES.map((branch) => ({
      ...branch,
      type: 'category' as const,
      children: (groupedProjects[branch.category] ?? []).map((project) => ({
        id: project.id,
        label: project.data.title,
        href: `/projects/${project.data.slug}/`
      }))
    })),
    {
      ...ABOUT_BRANCH,
      type: 'link' as const
    }
  ];
}
