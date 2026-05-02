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
import { navigate } from 'astro:transitions/client';

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

interface HomeRuntime {
  videoIntro: HTMLElement | null;
  video: HTMLVideoElement | null;
  skipButton: HTMLButtonElement | null;
  treeContainer: HTMLElement;
  graphSvg: SVGSVGElement;
  graphData: HTMLElement;
  nodes: GraphNode[];
  links: GraphLink[];
  nodeSelection: NodeSelection | null;
  linkSelection: LinkSelection | null;
  simulation: Simulation<GraphNode, GraphLink> | null;
  activeBranch: string | null;
  idleRaf: number;
  resizeRaf: number;
  introFinished: boolean;
  introRemovalTimer: number;
  removeResizeListener: (() => void) | null;
  viewport: { width: number; height: number };
}

const INTRO_SEEN_KEY = 'portfolio:intro-seen';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let currentHome: HomeRuntime | null = null;

const clamp = (value: number, lo: number, hi: number) =>
  value < lo ? lo : value > hi ? hi : value;

const refId = (ref: GraphLink['source'] | GraphLink['target'] | undefined): string =>
  typeof ref === 'object' ? ref?.id ?? '' : String(ref ?? '');

function readHomeRuntime(): HomeRuntime | null {
  const treeContainer = document.getElementById('tree-container');
  const graphSvg = document.querySelector<SVGSVGElement>('.home-graph');
  const graphData = document.getElementById('home-graph-data');

  if (!treeContainer || !graphSvg || !graphData) return null;

  const video = document.getElementById('intro-video');
  const skipButton = document.getElementById('skip-btn');

  return {
    videoIntro: document.getElementById('video-intro'),
    video: video instanceof HTMLVideoElement ? video : null,
    skipButton: skipButton instanceof HTMLButtonElement ? skipButton : null,
    treeContainer,
    graphSvg,
    graphData,
    nodes: [],
    links: [],
    nodeSelection: null,
    linkSelection: null,
    simulation: null,
    activeBranch: null,
    idleRaf: 0,
    resizeRaf: 0,
    introFinished: false,
    introRemovalTimer: 0,
    removeResizeListener: null,
    viewport: { width: 0, height: 0 }
  };
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

function readGeometry(runtime: HomeRuntime): Geometry {
  const { width, height } = runtime.viewport;
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

function parseGraphData(runtime: HomeRuntime): RawGraphData | null {
  const json = runtime.graphData.textContent?.trim();
  if (!json) return null;
  try {
    return JSON.parse(json) as RawGraphData;
  } catch {
    return null;
  }
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
  navigate(href);
}

function removeIntro(runtime: HomeRuntime) {
  runtime.video?.pause();
  runtime.videoIntro?.remove();
}

function dismissIntro(runtime: HomeRuntime) {
  if (runtime.introFinished) return;
  runtime.introFinished = true;
  runtime.videoIntro?.classList.add('is-finished');
  runtime.introRemovalTimer = window.setTimeout(() => removeIntro(runtime), 1600);
}

function skipIntroForSession(runtime: HomeRuntime) {
  runtime.introFinished = true;
  document.documentElement.classList.add('intro-seen');
  removeIntro(runtime);
}

function startIntro(runtime: HomeRuntime) {
  if (!runtime.video) {
    rememberIntroSeen();
    dismissIntro(runtime);
    return;
  }

  rememberIntroSeen();
  runtime.video.play().catch(() => dismissIntro(runtime));
  runtime.video.addEventListener('ended', () => dismissIntro(runtime), { once: true });
}

function setActiveBranch(runtime: HomeRuntime, branchId: string | null) {
  runtime.activeBranch = branchId;
  runtime.nodeSelection
    ?.classed('is-active', (node) => node.type === 'category' && node.id === branchId)
    .classed('is-visible', (node) => node.type !== 'project' || node.parentId === branchId)
    .attr('aria-expanded', (node) =>
      node.type === 'category' ? String(node.id === branchId) : null
    );
  runtime.linkSelection?.classed(
    'is-visible',
    (link) => link.type === 'primary' || refId(link.source) === branchId
  );
}

function computeAnchors(runtime: HomeRuntime, geo: Geometry) {
  const primaries = runtime.nodes.filter((n) => n.type === 'category' || n.type === 'link');
  const startAngle = -Math.PI * 0.36;
  primaries.forEach((node, index) => {
    const angle = startAngle + (index / primaries.length) * Math.PI * 2;
    node.anchorAngle = angle;
    node.anchorX = geo.cx + Math.cos(angle) * geo.horizontalRadius;
    node.anchorY = geo.cy + Math.sin(angle) * geo.verticalRadius;
  });

  const groups = new Map<string, GraphNode[]>();
  for (const node of runtime.nodes) {
    if (node.type !== 'project' || !node.parentId) continue;
    const list = groups.get(node.parentId);
    if (list) list.push(node);
    else groups.set(node.parentId, [node]);
  }
  for (const [parentId, siblings] of groups) {
    const parent = runtime.nodes.find((n) => n.id === parentId);
    if (!parent) continue;
    const parentAngle = parent.anchorAngle ?? 0;
    siblings.forEach((node, index) => {
      const spread = (index - (siblings.length - 1) / 2) * 0.34;
      const angle = parentAngle + spread;
      node.anchorX = (parent.anchorX ?? geo.cx) + Math.cos(angle) * geo.childRadius;
      node.anchorY = (parent.anchorY ?? geo.cy) + Math.sin(angle) * geo.childRadius;
    });
  }

  const root = runtime.nodes.find((n) => n.type === 'root');
  if (root) {
    root.anchorX = geo.cx;
    root.anchorY = geo.cy;
    root.fx = geo.cx;
    root.fy = geo.cy;
  }
}

function seedPositions(runtime: HomeRuntime) {
  runtime.nodes.forEach((node, index) => {
    if (node.x !== undefined && node.y !== undefined) return;
    const offset = node.type === 'project' ? 5 : 8;
    node.x = (node.anchorX ?? 0) + Math.cos(index * 1.7) * offset;
    node.y = (node.anchorY ?? 0) + Math.sin(index * 1.3) * offset;
    node.vx = 0;
    node.vy = 0;
  });
}

function constrainViewport(runtime: HomeRuntime, geo: Geometry) {
  for (const node of runtime.nodes) {
    if (node.type === 'root' || node.x === undefined || node.y === undefined) continue;
    const r = nodeRadius(node);
    const padX = Math.max(geo.pad, r);
    const padY = Math.max(geo.pad, r * 0.75);
    node.x = clamp(node.x, padX, geo.width - padX);
    node.y = clamp(node.y, padY, geo.height - padY);
  }
}

function render(runtime: HomeRuntime) {
  if (!runtime.linkSelection || !runtime.nodeSelection) return;
  constrainViewport(runtime, readGeometry(runtime));
  runtime.linkSelection
    .attr('x1', (link) => (link.source as GraphNode).x ?? 0)
    .attr('y1', (link) => (link.source as GraphNode).y ?? 0)
    .attr('x2', (link) => (link.target as GraphNode).x ?? 0)
    .attr('y2', (link) => (link.target as GraphNode).y ?? 0);
  runtime.nodeSelection.attr(
    'transform',
    (node) => `translate(${node.x ?? 0},${node.y ?? 0})`
  );
}

function updateViewport(runtime: HomeRuntime) {
  const { width, height } = runtime.treeContainer.getBoundingClientRect();
  runtime.viewport.width = width;
  runtime.viewport.height = height;
  runtime.graphSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
}

function captureSettled(runtime: HomeRuntime) {
  for (const node of runtime.nodes) {
    node.settledX = node.x;
    node.settledY = node.y;
  }
}

function stopIdle(runtime: HomeRuntime) {
  if (runtime.idleRaf) {
    cancelAnimationFrame(runtime.idleRaf);
    runtime.idleRaf = 0;
  }
}

function startIdle(runtime: HomeRuntime) {
  if (reduceMotion.matches || runtime.idleRaf) return;
  const start = performance.now();
  const tick = (now: number) => {
    if (currentHome !== runtime) return;
    const t = (now - start) * 0.001;
    for (const node of runtime.nodes) {
      if (node.type === 'root' || node.settledX === undefined || node.settledY === undefined) {
        continue;
      }
      const phase = t + node.phase;
      node.x = node.settledX + Math.cos(phase * 0.61) * node.sway * 2.4;
      node.y = node.settledY + Math.sin(phase) * node.sway * 3.4;
    }
    render(runtime);
    runtime.idleRaf = requestAnimationFrame(tick);
  };
  runtime.idleRaf = requestAnimationFrame(tick);
}

function ensureSimulation(runtime: HomeRuntime): Simulation<GraphNode, GraphLink> {
  if (runtime.simulation) return runtime.simulation;
  runtime.simulation = forceSimulation<GraphNode, GraphLink>(runtime.nodes)
    .alphaDecay(0.05)
    .alphaMin(0.02)
    .velocityDecay(0.7)
    .stop()
    .on('tick', () => render(runtime))
    .on('end', () => {
      captureSettled(runtime);
      startIdle(runtime);
    });
  return runtime.simulation;
}

function configureForces(runtime: HomeRuntime, geo: Geometry) {
  if (!runtime.simulation) return;
  runtime.simulation
    .force(
      'link',
      forceLink<GraphNode, GraphLink>(runtime.links)
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

function settle(runtime: HomeRuntime, { alpha, warmupTicks }: { alpha: number; warmupTicks: number }) {
  stopIdle(runtime);
  const geo = readGeometry(runtime);
  computeAnchors(runtime, geo);
  seedPositions(runtime);
  const sim = ensureSimulation(runtime);

  if (reduceMotion.matches) {
    runtime.nodes.forEach((node) => {
      node.x = node.anchorX;
      node.y = node.anchorY;
    });
    captureSettled(runtime);
    render(runtime);
    return;
  }

  configureForces(runtime, geo);
  sim.alpha(alpha);
  if (warmupTicks > 0) sim.tick(warmupTicks);
  render(runtime);
  sim.restart();
}

function buildSelections(runtime: HomeRuntime) {
  const svg = select(runtime.graphSvg);
  const linkLayer = svg.select<SVGGElement>('.graph-links');
  const nodeLayer = svg.select<SVGGElement>('.graph-nodes');

  runtime.linkSelection = linkLayer
    .selectAll<SVGLineElement, GraphLink>('line')
    .data(runtime.links, (link) => `${refId(link.source)}-${refId(link.target)}`)
    .join('line')
    .attr('class', (link) => `graph-link graph-link--${link.type}`)
    .classed('is-visible', (link) => link.type === 'primary');

  const interactive = runtime.nodes.filter((node) => node.type !== 'root');
  runtime.nodeSelection = nodeLayer
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

  runtime.nodeSelection
    .attr('role', (node) => (node.type === 'category' ? 'button' : 'link'))
    .attr('tabindex', '0')
    .attr('aria-expanded', (node) => (node.type === 'category' ? 'false' : null))
    .on('click', (event, node) => {
      if (node.href) handleNavigate(event, node.href);
      else setActiveBranch(runtime, runtime.activeBranch === node.id ? null : node.id);
    })
    .on('keydown', (event, node) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (node.href) navigate(node.href);
      else setActiveBranch(runtime, runtime.activeBranch === node.id ? null : node.id);
    });
}

function initializeGraph(runtime: HomeRuntime) {
  const data = parseGraphData(runtime);
  if (!data) return;

  runtime.nodes = data.nodes.map((node, index) => ({
    ...node,
    phase: index * 1.618,
    sway: node.type === 'project' ? 0.65 : 0.5
  }));
  runtime.links = data.links.map((link) => ({ ...link }));

  buildSelections(runtime);
  setActiveBranch(runtime, null);
  updateViewport(runtime);
  settle(runtime, { alpha: 0.9, warmupTicks: 8 });

  const handleResize = () => {
    if (runtime.resizeRaf) cancelAnimationFrame(runtime.resizeRaf);
    runtime.resizeRaf = requestAnimationFrame(() => {
      runtime.resizeRaf = 0;
      updateViewport(runtime);
      settle(runtime, { alpha: 0.45, warmupTicks: 0 });
    });
  };

  window.addEventListener('resize', handleResize);
  runtime.removeResizeListener = () => window.removeEventListener('resize', handleResize);
}

function cleanupHomePage() {
  const runtime = currentHome;
  currentHome = null;
  if (!runtime) return;

  runtime.simulation?.stop();
  runtime.simulation = null;
  stopIdle(runtime);
  if (runtime.resizeRaf) {
    cancelAnimationFrame(runtime.resizeRaf);
    runtime.resizeRaf = 0;
  }
  if (runtime.introRemovalTimer) {
    clearTimeout(runtime.introRemovalTimer);
    runtime.introRemovalTimer = 0;
  }
  runtime.removeResizeListener?.();
  runtime.removeResizeListener = null;
}

function initializeHomePage() {
  const nextRuntime = readHomeRuntime();
  if (!nextRuntime) {
    cleanupHomePage();
    return;
  }

  cleanupHomePage();
  currentHome = nextRuntime;
  document.body.classList.add('js-enabled');

  initializeGraph(nextRuntime);

  if (document.documentElement.classList.contains('intro-seen') || hasSeenIntroThisSession()) {
    skipIntroForSession(nextRuntime);
  } else {
    startIntro(nextRuntime);
  }

  nextRuntime.skipButton?.addEventListener('click', () => dismissIntro(nextRuntime), {
    once: true
  });
}

function handleBeforeSwap(event: Event) {
  cleanupHomePage();
  if (!hasSeenIntroThisSession()) return;
  const swapEvent = event as Event & { newDocument?: Document };
  swapEvent.newDocument?.documentElement.classList.add('intro-seen');
}

document.addEventListener('astro:page-load', initializeHomePage);
document.addEventListener('astro:before-swap', handleBeforeSwap);
