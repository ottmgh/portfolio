import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum
} from 'd3-force';
import { select, type Selection } from 'd3-selection';

type GraphNodeType = 'root' | 'category' | 'project' | 'link';
type GraphLinkType = 'primary' | 'child';

interface HomeGraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  href?: string;
  parentId?: string;
  childCount?: number;
}

interface HomeGraphLink {
  source: string;
  target: string;
  type: GraphLinkType;
}

interface HomeGraphData {
  nodes: HomeGraphNode[];
  links: HomeGraphLink[];
}

interface GraphNodeDatum extends HomeGraphNode, SimulationNodeDatum {
  anchorX?: number;
  anchorY?: number;
  phase?: number;
  sway?: number;
  settleX?: number;
  settleY?: number;
}

interface GraphLinkDatum extends SimulationLinkDatum<GraphNodeDatum> {
  type: GraphLinkType;
}

type NodeSelection = Selection<SVGGElement, GraphNodeDatum, SVGGElement, unknown>;
type LinkSelection = Selection<SVGLineElement, GraphLinkDatum, SVGGElement, unknown>;

const videoIntro = document.getElementById('video-intro');
const video = document.getElementById('intro-video');
const skipButton = document.getElementById('skip-btn');
const pageTransition = document.getElementById('page-transition');
const treeContainer = document.getElementById('tree-container');
const graphSvg = document.querySelector<SVGSVGElement>('.home-graph');
const graphDataElement = document.getElementById('home-graph-data');
const pageLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-page-link]'));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let activeBranchId: string | null = null;
let introFinished = false;
let simulation: Simulation<GraphNodeDatum, GraphLinkDatum> | null = null;
let graphNodes: GraphNodeDatum[] = [];
let graphLinks: GraphLinkDatum[] = [];
let linkSelection: LinkSelection | null = null;
let nodeSelection: NodeSelection | null = null;
let tickCount = 0;

function parseGraphData(): HomeGraphData | null {
  if (!graphDataElement?.textContent) {
    return null;
  }

  try {
    return JSON.parse(graphDataElement.textContent) as HomeGraphData;
  } catch {
    return null;
  }
}

function getNodeId(node: string | number | GraphNodeDatum | undefined) {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  return node?.id;
}

function getNodeDatum(node: string | number | GraphNodeDatum | undefined) {
  return typeof node === 'object' ? node : undefined;
}

function navigateTo(url: string) {
  pageTransition?.classList.add('active');

  window.setTimeout(() => {
    window.location.href = url;
  }, 800);
}

function handleGraphNavigation(event: MouseEvent, href: string, target?: string | null) {
  const isModifiedClick =
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0;

  if (isModifiedClick || target === '_blank') {
    return;
  }

  event.preventDefault();
  navigateTo(href);
}

function finishIntro() {
  if (introFinished) {
    return;
  }

  introFinished = true;
  videoIntro?.classList.add('is-finished');

  window.setTimeout(() => {
    videoIntro?.remove();

    if (video instanceof HTMLVideoElement) {
      video.pause();
    }
  }, 1600);
}

function radiusFor(node: GraphNodeDatum) {
  const labelRadius = Math.min(92, Math.max(34, node.label.length * 4.2));

  if (node.type === 'root') return 128;
  if (node.type === 'category') return labelRadius + 24;
  if (node.type === 'link') return labelRadius + 18;
  return labelRadius + 14;
}

function dotRadiusFor(node: GraphNodeDatum) {
  if (node.type === 'project') return 2.5;
  return 3.5;
}

function hitWidthFor(node: GraphNodeDatum) {
  const characterWidth = node.type === 'project' ? 8.5 : 7.4;
  return Math.max(64, Math.min(220, node.label.length * characterWidth + 28));
}

function hitHeightFor(node: GraphNodeDatum) {
  return node.type === 'project' ? 48 : 52;
}

function setActiveBranch(branchId: string | null) {
  activeBranchId = branchId;

  nodeSelection
    ?.classed('is-active', (node) => node.type === 'category' && node.id === branchId)
    .classed('is-visible', (node) => node.type !== 'project' || node.parentId === branchId)
    .attr('aria-expanded', (node) =>
      node.type === 'category' ? String(node.id === branchId) : null
    );

  linkSelection?.classed('is-visible', (link) => {
    if (link.type === 'primary') {
      return true;
    }

    const sourceId = getNodeId(link.source);
    const targetId = getNodeId(link.target);

    return (
      sourceId === branchId ||
      graphNodes.some((node) => node.id === targetId && node.parentId === branchId)
    );
  });
}

function applyAnchors(width: number, height: number) {
  const mainNodes = graphNodes.filter((node) => node.type === 'category' || node.type === 'link');
  const horizontalRadius = Math.max(165, Math.min(width * 0.32, 275));
  const verticalRadius = Math.max(125, Math.min(height * 0.27, 225));
  const fallbackAngles = [-65, 8, 78, 145, 215];

  mainNodes.forEach((node, index) => {
    const angle = ((fallbackAngles[index] ?? -65 + index * 72) * Math.PI) / 180;
    node.anchorX = width / 2 + Math.cos(angle) * horizontalRadius;
    node.anchorY = height / 2 + Math.sin(angle) * verticalRadius;

    node.x ??= node.anchorX;
    node.y ??= node.anchorY;
  });

  graphNodes
    .filter((node) => node.type === 'project')
    .forEach((node, index) => {
      const parent = graphNodes.find((candidate) => candidate.id === node.parentId);
      const siblings = graphNodes.filter((candidate) => candidate.parentId === node.parentId);
      const siblingIndex = siblings.findIndex((candidate) => candidate.id === node.id);
      const parentAngle = parent
        ? Math.atan2(
            (parent.anchorY ?? height / 2) - height / 2,
            (parent.anchorX ?? width / 2) - width / 2
          )
        : 0;
      const angle = parentAngle + (siblingIndex - (siblings.length - 1) / 2) * 0.34;
      const distance = Math.max(88, Math.min(125, width * 0.12));

      node.anchorX = (parent?.anchorX ?? width / 2) + Math.cos(angle) * distance;
      node.anchorY = (parent?.anchorY ?? height / 2) + Math.sin(angle) * distance;

      node.x ??= node.anchorX + (index % 2 === 0 ? 8 : -8);
      node.y ??= node.anchorY + (index % 3 - 1) * 8;
    });
}

function seedNodePositions() {
  graphNodes.forEach((node, index) => {
    if (node.anchorX === undefined || node.anchorY === undefined) {
      return;
    }

    if (node.type === 'root') {
      node.x = node.anchorX;
      node.y = node.anchorY;
    } else {
      const offset = node.type === 'project' ? 5 : 8;
      node.x = node.anchorX + Math.cos((node.phase ?? index) * 1.7) * offset;
      node.y = node.anchorY + Math.sin((node.phase ?? index) * 1.3) * offset;
    }

    node.vx = 0;
    node.vy = 0;
  });
}

function createSoftIdleForce() {
  let nodes: GraphNodeDatum[] = [];

  function force() {
    if (reduceMotion.matches) {
      return;
    }

    tickCount += 1;

    for (const node of nodes) {
      if (node.type === 'root' || node.settleX === undefined || node.settleY === undefined) {
        continue;
      }

      const phase = tickCount * 0.012 + (node.phase ?? 0);
      const distance = node.sway ?? 1;
      const targetX = node.settleX + Math.cos(phase * 0.61) * distance * 2.4;
      const targetY = node.settleY + Math.sin(phase) * distance * 3.4;

      node.vx = (node.vx ?? 0) + (targetX - (node.x ?? targetX)) * 0.008;
      node.vy = (node.vy ?? 0) + (targetY - (node.y ?? targetY)) * 0.008;
    }
  }

  force.initialize = (nextNodes: GraphNodeDatum[]) => {
    nodes = nextNodes;
  };

  return force;
}

function constrainNodes(width: number, height: number) {
  const padding = Math.max(34, Math.min(72, width * 0.07));

  graphNodes.forEach((node) => {
    if (node.type === 'root') {
      node.x = width / 2;
      node.y = height / 2;
      return;
    }

    const nodeRadius = radiusFor(node);
    const horizontalPadding = Math.max(padding, nodeRadius);
    const verticalPadding = Math.max(padding, nodeRadius * 0.75);

    node.x = Math.min(width - horizontalPadding, Math.max(horizontalPadding, node.x ?? width / 2));
    node.y = Math.min(height - verticalPadding, Math.max(verticalPadding, node.y ?? height / 2));
  });
}

function renderGraph() {
  if (!treeContainer || !graphSvg) {
    return;
  }

  const { width, height } = treeContainer.getBoundingClientRect();
  graphSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  constrainNodes(width, height);

  linkSelection
    ?.attr('x1', (link) => String(getNodeDatum(link.source)?.x ?? width / 2))
    .attr('y1', (link) => String(getNodeDatum(link.source)?.y ?? height / 2))
    .attr('x2', (link) => String(getNodeDatum(link.target)?.x ?? width / 2))
    .attr('y2', (link) => String(getNodeDatum(link.target)?.y ?? height / 2));

  nodeSelection?.attr(
    'transform',
    (node) => `translate(${Math.round(node.x ?? width / 2)},${Math.round(node.y ?? height / 2)})`
  );
}

function restartSimulation() {
  if (!treeContainer || !simulation) {
    return;
  }

  const { width, height } = treeContainer.getBoundingClientRect();
  const compact = width < 680;
  const primaryDistance = Math.max(130, Math.min(compact ? 180 : 225, width * 0.21));
  const childDistance = Math.max(72, Math.min(compact ? 108 : 132, width * 0.115));

  applyAnchors(width, height);

  const root = graphNodes.find((node) => node.type === 'root');
  if (root) {
    root.anchorX = width / 2;
    root.anchorY = height / 2;
    root.fx = width / 2;
    root.fy = height / 2;
  }

  const needsInitialSeed = graphNodes.some((node) => node.x === undefined || node.y === undefined);
  if (needsInitialSeed) {
    seedNodePositions();
    renderGraph();
  }

  simulation
    .force(
      'link',
      forceLink<GraphNodeDatum, GraphLinkDatum>(graphLinks)
        .id((node) => node.id)
        .distance((link) => (link.type === 'primary' ? primaryDistance : childDistance))
        .strength((link) => (link.type === 'primary' ? 0.9 : 0.78))
        .iterations(3)
    )
    .force(
      'charge',
      forceManyBody<GraphNodeDatum>().strength((node) => (node.type === 'root' ? -520 : -75))
    )
    .force('collide', forceCollide<GraphNodeDatum>().radius(radiusFor).strength(0.82).iterations(2))
    .force('center', forceCenter(width / 2, height / 2).strength(0.04))
    .force(
      'x',
      forceX<GraphNodeDatum>((node) => node.anchorX ?? width / 2).strength((node) =>
        node.type === 'root' ? 1 : 0.32
      )
    )
    .force(
      'y',
      forceY<GraphNodeDatum>((node) => node.anchorY ?? height / 2).strength((node) =>
        node.type === 'root' ? 1 : 0.32
      )
    )
    .force('idle', null)
    .alpha(0.9)
    .alphaTarget(0)
    .restart();

  simulation.tick(24);
  renderGraph();

  window.setTimeout(() => {
    if (!simulation) {
      return;
    }

    graphNodes.forEach((node) => {
      node.settleX = node.x;
      node.settleY = node.y;
    });

    simulation
      .force('link', null)
      .force('charge', null)
      .force('collide', null)
      .force('center', null)
      .force('idle', createSoftIdleForce())
      .alpha(0.16)
      .alphaDecay(0)
      .velocityDecay(0.86)
      .alphaTarget(reduceMotion.matches ? 0 : 0.03)
      .restart();
  }, 900);
}

function handleCategoryKeydown(event: KeyboardEvent, node: GraphNodeDatum) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  setActiveBranch(activeBranchId === node.id ? null : node.id);
}

function initializeGraph() {
  const graphData = parseGraphData();

  if (!graphData || !graphSvg) {
    return;
  }

  graphNodes = graphData.nodes.map((node, index) => ({
    ...node,
    phase: index * 1.618,
    sway: node.type === 'project' ? 0.65 : 0.5
  }));
  graphLinks = graphData.links.map((link) => ({ ...link }));

  const svg = select(graphSvg);
  const linkLayer = svg.select<SVGGElement>('.graph-links');
  const nodeLayer = svg.select<SVGGElement>('.graph-nodes');

  linkSelection = linkLayer
    .selectAll<SVGLineElement, GraphLinkDatum>('line')
    .data(graphLinks, (link) => `${getNodeId(link.source)}-${getNodeId(link.target)}`)
    .join('line')
    .attr('class', (link) => `graph-link graph-link--${link.type}`)
    .classed('is-visible', (link) => link.type === 'primary');

  const interactiveNodes = graphNodes.filter((node) => node.type !== 'root');

  nodeSelection = nodeLayer
    .selectAll<SVGGElement, GraphNodeDatum>('g')
    .data(interactiveNodes, (node) => node.id)
    .join((enter) => {
      const node = enter
        .append('g')
        .attr('class', (datum) => `graph-node graph-node--${datum.type}`)
        .attr('data-graph-node', (datum) => datum.id);

      node
        .append('rect')
        .attr('class', 'graph-hit-area')
        .attr('x', (datum) => -hitWidthFor(datum) / 2)
        .attr('y', -10)
        .attr('width', hitWidthFor)
        .attr('height', hitHeightFor)
        .attr('rx', 3);
      node.append('circle').attr('class', 'graph-dot').attr('r', dotRadiusFor);
      node
        .append('text')
        .attr('class', 'graph-label')
        .attr('text-anchor', 'middle')
        .attr('y', (datum) => (datum.type === 'project' ? 22 : 24))
        .text((datum) => datum.label);

      return node;
    });

  nodeSelection
    .attr('role', (node) => (node.type === 'category' ? 'button' : 'link'))
    .attr('tabindex', '0')
    .attr('aria-expanded', (node) => (node.type === 'category' ? 'false' : null))
    .on('click', (event, node) => {
      if (node.href) {
        handleGraphNavigation(event, node.href);
        return;
      }

      setActiveBranch(activeBranchId === node.id ? null : node.id);
    })
    .on('keydown', (event, node) => {
      if (node.href && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        navigateTo(node.href);
        return;
      }

      if (node.type === 'category') {
        handleCategoryKeydown(event, node);
      }
    });

  simulation = forceSimulation<GraphNodeDatum, GraphLinkDatum>(graphNodes)
    .alphaDecay(0.045)
    .velocityDecay(0.7)
    .on('tick', renderGraph);

  restartSimulation();
  setActiveBranch(null);

  window.addEventListener('resize', restartSimulation);
  window.addEventListener('pagehide', () => {
    simulation?.stop();
  });
}

document.body.classList.add('js-enabled');
initializeGraph();

pageLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    handleGraphNavigation(event, link.href, link.target);
  });
});

if (video instanceof HTMLVideoElement) {
  video.play().catch(finishIntro);
  video.addEventListener('ended', finishIntro, { once: true });
} else {
  finishIntro();
}

if (skipButton instanceof HTMLButtonElement) {
  skipButton.addEventListener('click', finishIntro);
}
