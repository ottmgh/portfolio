import {
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

interface RawGraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  href?: string;
  parentId?: string;
  childCount?: number;
}

interface RawGraphLink {
  source: string;
  target: string;
  type: GraphLinkType;
}

interface RawGraphData {
  nodes: RawGraphNode[];
  links: RawGraphLink[];
}

interface GraphNode extends RawGraphNode, SimulationNodeDatum {
  anchorX?: number;
  anchorY?: number;
  anchorAngle?: number;
  // Settled position captured when the layout finishes — used as the centre
  // around which the idle sway oscillates.
  settledX?: number;
  settledY?: number;
  phase: number;
  sway: number;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  type: GraphLinkType;
}

type NodeSelection = Selection<SVGGElement, GraphNode, SVGGElement, unknown>;
type LinkSelection = Selection<SVGLineElement, GraphLink, SVGGElement, unknown>;

interface Geometry {
  width: number;
  height: number;
  cx: number;
  cy: number;
  compact: boolean;
  horizontalRadius: number;
  verticalRadius: number;
  childRadius: number;
  primaryDistance: number;
  childDistance: number;
  pad: number;
}

const $videoIntro = document.getElementById('video-intro');
const $video = document.getElementById('intro-video');
const $skipButton = document.getElementById('skip-btn');
const $pageTransition = document.getElementById('page-transition');
const $treeContainer = document.getElementById('tree-container');
const $graphSvg = document.querySelector<SVGSVGElement>('.home-graph');
const $graphData = document.getElementById('home-graph-data');
const $pageLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-page-link]'));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const INTRO_SEEN_KEY = 'portfolio:intro-seen';

let nodes: GraphNode[] = [];
let links: GraphLink[] = [];
let nodeSelection: NodeSelection | null = null;
let linkSelection: LinkSelection | null = null;
let simulation: Simulation<GraphNode, GraphLink> | null = null;
let activeBranch: string | null = null;
let idleRaf = 0;
let resizeRaf = 0;
let introFinished = false;
const viewport = { width: 0, height: 0 };

const clamp = (value: number, lo: number, hi: number) =>
  value < lo ? lo : value > hi ? hi : value;

const refId = (ref: GraphLink['source'] | GraphLink['target'] | undefined): string =>
  typeof ref === 'object' ? ref?.id ?? '' : String(ref ?? '');

function nodeRadius(node: GraphNode): number {
  const labelRadius = clamp(node.label.length * 4.2, 34, 92);
  if (node.type === 'root') return 128;
  if (node.type === 'category') return labelRadius + 24;
  if (node.type === 'link') return labelRadius + 18;
  return labelRadius + 14;
}

const dotRadius = (node: GraphNode) => (node.type === 'project' ? 2.5 : 3.5);
const hitWidth = (node: GraphNode) =>
  clamp(node.label.length * (node.type === 'project' ? 8.5 : 7.4) + 28, 64, 220);
const hitHeight = (node: GraphNode) => (node.type === 'project' ? 48 : 52);
const labelOffset = (node: GraphNode) => (node.type === 'project' ? 22 : 24);

function readGeometry(): Geometry {
  const { width, height } = viewport;
  const compact = width < 680;
  return {
    width,
    height,
    compact,
    cx: width / 2,
    cy: height / 2,
    horizontalRadius: clamp(width * 0.32, 165, 275),
    verticalRadius: clamp(height * 0.27, 125, 225),
    childRadius: clamp(width * 0.12, 88, 125),
    primaryDistance: clamp(width * 0.21, 130, compact ? 180 : 225),
    childDistance: clamp(width * 0.115, 72, compact ? 108 : 132),
    pad: clamp(width * 0.07, 34, 72)
  };
}

function parseGraphData(): RawGraphData | null {
  const json = $graphData?.textContent?.trim();
  if (!json) return null;
  try {
    return JSON.parse(json) as RawGraphData;
  } catch {
    return null;
  }
}

function navigateTo(url: string) {
  $pageTransition?.classList.add('active');
  window.setTimeout(() => {
    window.location.href = url;
  }, 800);
}

function isPlainClick(event: MouseEvent) {
  return (
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.button === 0
  );
}

function handleNavigate(event: MouseEvent, href: string, target?: string | null) {
  if (!isPlainClick(event) || target === '_blank') return;
  event.preventDefault();
  navigateTo(href);
}

function hasSeenIntroThisSession() {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

function rememberIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, 'true');
  } catch {
    // Storage may be blocked; intro still functions without persistence.
  }
}

function finishIntro({ remember = true } = {}) {
  if (introFinished) return;
  introFinished = true;
  if (remember) rememberIntroSeen();
  $videoIntro?.classList.add('is-finished');
  window.setTimeout(() => {
    $videoIntro?.remove();
    if ($video instanceof HTMLVideoElement) $video.pause();
  }, 1600);
}

function setActiveBranch(branchId: string | null) {
  activeBranch = branchId;
  nodeSelection
    ?.classed('is-active', (node) => node.type === 'category' && node.id === branchId)
    .classed('is-visible', (node) => node.type !== 'project' || node.parentId === branchId)
    .attr('aria-expanded', (node) =>
      node.type === 'category' ? String(node.id === branchId) : null
    );
  linkSelection?.classed(
    'is-visible',
    (link) => link.type === 'primary' || refId(link.source) === branchId
  );
}

function computeAnchors(geo: Geometry) {
  const primaries = nodes.filter((n) => n.type === 'category' || n.type === 'link');
  const startAngle = -Math.PI * 0.36;
  primaries.forEach((node, index) => {
    const angle = startAngle + (index / primaries.length) * Math.PI * 2;
    node.anchorAngle = angle;
    node.anchorX = geo.cx + Math.cos(angle) * geo.horizontalRadius;
    node.anchorY = geo.cy + Math.sin(angle) * geo.verticalRadius;
  });

  const groups = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    if (node.type !== 'project' || !node.parentId) continue;
    const list = groups.get(node.parentId);
    if (list) list.push(node);
    else groups.set(node.parentId, [node]);
  }
  for (const [parentId, siblings] of groups) {
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) continue;
    const parentAngle = parent.anchorAngle ?? 0;
    siblings.forEach((node, index) => {
      const spread = (index - (siblings.length - 1) / 2) * 0.34;
      const angle = parentAngle + spread;
      node.anchorX = (parent.anchorX ?? geo.cx) + Math.cos(angle) * geo.childRadius;
      node.anchorY = (parent.anchorY ?? geo.cy) + Math.sin(angle) * geo.childRadius;
    });
  }

  const root = nodes.find((n) => n.type === 'root');
  if (root) {
    root.anchorX = geo.cx;
    root.anchorY = geo.cy;
    root.fx = geo.cx;
    root.fy = geo.cy;
  }
}

function seedPositions() {
  nodes.forEach((node, index) => {
    if (node.x !== undefined && node.y !== undefined) return;
    const offset = node.type === 'project' ? 5 : 8;
    node.x = (node.anchorX ?? 0) + Math.cos(index * 1.7) * offset;
    node.y = (node.anchorY ?? 0) + Math.sin(index * 1.3) * offset;
    node.vx = 0;
    node.vy = 0;
  });
}

function constrainViewport(geo: Geometry) {
  for (const node of nodes) {
    if (node.type === 'root' || node.x === undefined || node.y === undefined) continue;
    const r = nodeRadius(node);
    const padX = Math.max(geo.pad, r);
    const padY = Math.max(geo.pad, r * 0.75);
    node.x = clamp(node.x, padX, geo.width - padX);
    node.y = clamp(node.y, padY, geo.height - padY);
  }
}

function render() {
  if (!linkSelection || !nodeSelection) return;
  constrainViewport(readGeometry());
  linkSelection
    .attr('x1', (link) => (link.source as GraphNode).x ?? 0)
    .attr('y1', (link) => (link.source as GraphNode).y ?? 0)
    .attr('x2', (link) => (link.target as GraphNode).x ?? 0)
    .attr('y2', (link) => (link.target as GraphNode).y ?? 0);
  nodeSelection.attr(
    'transform',
    (node) => `translate(${node.x ?? 0},${node.y ?? 0})`
  );
}

function updateViewport() {
  if (!$treeContainer || !$graphSvg) return;
  const { width, height } = $treeContainer.getBoundingClientRect();
  viewport.width = width;
  viewport.height = height;
  $graphSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
}

function ensureSimulation(): Simulation<GraphNode, GraphLink> {
  if (simulation) return simulation;
  simulation = forceSimulation<GraphNode, GraphLink>(nodes)
    .alphaDecay(0.05)
    .alphaMin(0.02)
    .velocityDecay(0.7)
    .stop()
    .on('tick', render)
    .on('end', () => {
      captureSettled();
      startIdle();
    });
  return simulation;
}

function captureSettled() {
  for (const node of nodes) {
    node.settledX = node.x;
    node.settledY = node.y;
  }
}

function configureForces(geo: Geometry) {
  if (!simulation) return;
  simulation
    .force(
      'link',
      forceLink<GraphNode, GraphLink>(links)
        .id((node) => node.id)
        .distance((link) =>
          link.type === 'primary' ? geo.primaryDistance : geo.childDistance
        )
        .strength((link) => (link.type === 'primary' ? 0.9 : 0.78))
        .iterations(3)
    )
    .force(
      'charge',
      forceManyBody<GraphNode>().strength((node) => (node.type === 'root' ? -520 : -75))
    )
    .force(
      'collide',
      forceCollide<GraphNode>().radius(nodeRadius).strength(0.82).iterations(2)
    )
    .force(
      'x',
      forceX<GraphNode>((node) => node.anchorX ?? 0).strength((node) =>
        node.type === 'root' ? 1 : 0.32
      )
    )
    .force(
      'y',
      forceY<GraphNode>((node) => node.anchorY ?? 0).strength((node) =>
        node.type === 'root' ? 1 : 0.32
      )
    );
}

function settle({ alpha, warmupTicks }: { alpha: number; warmupTicks: number }) {
  stopIdle();
  const geo = readGeometry();
  computeAnchors(geo);
  seedPositions();
  const sim = ensureSimulation();

  if (reduceMotion.matches) {
    nodes.forEach((node) => {
      node.x = node.anchorX;
      node.y = node.anchorY;
    });
    captureSettled();
    render();
    return;
  }

  configureForces(geo);
  sim.alpha(alpha);
  if (warmupTicks > 0) sim.tick(warmupTicks);
  render();
  sim.restart();
}

function startIdle() {
  if (reduceMotion.matches || idleRaf) return;
  const start = performance.now();
  const tick = (now: number) => {
    const t = (now - start) * 0.001;
    for (const node of nodes) {
      if (node.type === 'root' || node.settledX === undefined || node.settledY === undefined) {
        continue;
      }
      const phase = t + node.phase;
      node.x = node.settledX + Math.cos(phase * 0.61) * node.sway * 2.4;
      node.y = node.settledY + Math.sin(phase) * node.sway * 3.4;
    }
    render();
    idleRaf = requestAnimationFrame(tick);
  };
  idleRaf = requestAnimationFrame(tick);
}

function stopIdle() {
  if (idleRaf) {
    cancelAnimationFrame(idleRaf);
    idleRaf = 0;
  }
}

function buildSelections() {
  if (!$graphSvg) return false;
  const svg = select($graphSvg);
  const linkLayer = svg.select<SVGGElement>('.graph-links');
  const nodeLayer = svg.select<SVGGElement>('.graph-nodes');

  linkSelection = linkLayer
    .selectAll<SVGLineElement, GraphLink>('line')
    .data(links, (link) => `${refId(link.source)}-${refId(link.target)}`)
    .join('line')
    .attr('class', (link) => `graph-link graph-link--${link.type}`)
    .classed('is-visible', (link) => link.type === 'primary');

  const interactive = nodes.filter((node) => node.type !== 'root');
  nodeSelection = nodeLayer
    .selectAll<SVGGElement, GraphNode>('g')
    .data(interactive, (node) => node.id)
    .join((enter) => {
      const group = enter
        .append('g')
        .attr('class', (node) => `graph-node graph-node--${node.type}`)
        .attr('data-graph-node', (node) => node.id);
      group
        .append('rect')
        .attr('class', 'graph-hit-area')
        .attr('x', (node) => -hitWidth(node) / 2)
        .attr('y', -10)
        .attr('width', hitWidth)
        .attr('height', hitHeight)
        .attr('rx', 3);
      group.append('circle').attr('class', 'graph-dot').attr('r', dotRadius);
      group
        .append('text')
        .attr('class', 'graph-label')
        .attr('text-anchor', 'middle')
        .attr('y', labelOffset)
        .text((node) => node.label);
      return group;
    });

  nodeSelection
    .attr('role', (node) => (node.type === 'category' ? 'button' : 'link'))
    .attr('tabindex', '0')
    .attr('aria-expanded', (node) => (node.type === 'category' ? 'false' : null))
    .on('click', (event, node) => {
      if (node.href) handleNavigate(event, node.href);
      else setActiveBranch(activeBranch === node.id ? null : node.id);
    })
    .on('keydown', (event, node) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (node.href) navigateTo(node.href);
      else setActiveBranch(activeBranch === node.id ? null : node.id);
    });

  return true;
}

function initializeGraph() {
  const data = parseGraphData();
  if (!data || !$graphSvg || !$treeContainer) return;

  nodes = data.nodes.map((node, index) => ({
    ...node,
    phase: index * 1.618,
    sway: node.type === 'project' ? 0.65 : 0.5
  }));
  links = data.links.map((link) => ({ ...link }));

  if (!buildSelections()) return;

  setActiveBranch(null);
  updateViewport();
  settle({ alpha: 0.9, warmupTicks: 8 });

  window.addEventListener('resize', () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      updateViewport();
      settle({ alpha: 0.45, warmupTicks: 0 });
    });
  });

  window.addEventListener('pagehide', () => {
    simulation?.stop();
    stopIdle();
  });
}

document.body.classList.add('js-enabled');
initializeGraph();

$pageLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    handleNavigate(event, link.href, link.target);
  });
});

if (hasSeenIntroThisSession()) {
  finishIntro({ remember: false });
} else if ($video instanceof HTMLVideoElement) {
  $video.play().catch(() => finishIntro());
  $video.addEventListener('ended', () => finishIntro(), { once: true });
} else {
  finishIntro();
}

if ($skipButton instanceof HTMLButtonElement) {
  $skipButton.addEventListener('click', () => finishIntro());
}
