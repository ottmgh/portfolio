import { getCollection } from 'astro:content';

const BRANCH_CONFIG = [
  { id: 'films', label: 'Films', angle: -60, distance: 180, category: 'Film' },
  { id: 'docs', label: 'Documentaries', angle: 0, distance: 200, category: 'Documentary' },
  { id: 'shorts', label: 'Short Films', angle: 60, distance: 180, category: 'Short Film' },
  { id: 'experimental', label: 'Experimental', angle: 140, distance: 190, category: 'Experimental' },
  { id: 'about', label: 'About', angle: -140, distance: 170 }
] as const;

export async function getPortfolioContent() {
  const [homeEntry] = await getCollection('home');

  if (!homeEntry) {
    throw new Error('Missing homepage content entry in src/content/site/home.yml');
  }

  const projects = (await getCollection('projects')).sort(
    (left, right) => left.data.projectId - right.data.projectId
  );

  return { home: homeEntry.data, projects };
}

export function buildTreeData(
  projects: Awaited<ReturnType<typeof getPortfolioContent>>['projects']
) {
  return {
    branches: BRANCH_CONFIG.map((branch) => ({
      id: branch.id,
      label: branch.label,
      angle: branch.angle,
      distance: branch.distance,
      children:
        'category' in branch
          ? projects
              .filter((project) => project.data.category === branch.category)
              .map((project) => ({
                id: `project-${project.data.projectId}`,
                label: project.data.title,
                page: `project.html?id=${project.data.projectId}`
              }))
          : []
    }))
  };
}

export function buildProjectMap(
  projects: Awaited<ReturnType<typeof getPortfolioContent>>['projects']
) {
  return Object.fromEntries(
    projects.map((project) => [
      String(project.data.projectId),
      {
        title: project.data.title,
        category: project.data.category,
        year: String(project.data.year),
        video: project.data.video ?? '/media/videos/ott.mp4',
        description: project.data.description,
        details: {
          format: project.data.format ?? '',
          duration: project.data.duration ?? '',
          year: String(project.data.year),
          status: project.data.status ?? ''
        }
      }
    ])
  );
}
