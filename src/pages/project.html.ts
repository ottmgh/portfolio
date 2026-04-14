import { buildProjectMap, getPortfolioContent } from '../lib/portfolio';
import { renderProjectPage } from '../lib/render-project-page';

export const prerender = true;

export async function GET() {
  const { projects } = await getPortfolioContent();
  const projectsJson = JSON.stringify(buildProjectMap(projects)).replace(/</g, '\\u003c');

  return new Response(renderProjectPage(projectsJson), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
}
