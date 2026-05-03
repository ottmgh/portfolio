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
  revealIndex: number;
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

const ROMAN_TABLE: ReadonlyArray<readonly [number, string]> = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I']
];

function toRomanNumeral(input: number): string {
  let value = Math.max(0, Math.floor(input));
  if (value === 0) return '';
  let out = '';
  for (const [v, glyph] of ROMAN_TABLE) {
    while (value >= v) {
      out += glyph;
      value -= v;
    }
  }
  return out;
}

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
    horizontalRadius: clamp(width * 0.32, compact ? 100 : 165, 320),
    verticalRadius: clamp(height * 0.27, compact ? 100 : 125, 240),
    childRadius: clamp(width * 0.14, compact ? 50 : 88, 125),
    primaryDistance: clamp(width * 0.21, compact ? 80 : 130, compact ? 180 : 260),
    childDistance: clamp(width * 0.115, compact ? 40 : 72, compact ? 108 : 132),
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

  const weights = primaries.map((n) => 1 + (n.childCount ?? 0) * 0.5);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const startAngle = -Math.PI * 0.36;
  let cumWeight = 0;
  primaries.forEach((node, index) => {
    const midWeight = cumWeight + weights[index] / 2;
    const angle = startAngle + (midWeight / totalWeight) * Math.PI * 2;
    node.anchorAngle = angle;
    node.anchorX = geo.cx + Math.cos(angle) * geo.horizontalRadius;
    node.anchorY = geo.cy + Math.sin(angle) * geo.verticalRadius;
    cumWeight += weights[index];
  });

  if (geo.compact) {
    const labelPad = 60;
    for (const node of primaries) {
      node.anchorX = clamp(node.anchorX!, labelPad, geo.width - labelPad);
      node.anchorY = clamp(node.anchorY!, geo.pad + 20, geo.height - geo.pad - 20);
    }
  }

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
    const spread = Math.min(0.34, 1.2 / (siblings.length + 1));
    const radius = geo.childRadius * (1 + Math.max(0, siblings.length - 2) * 0.1);
    siblings.forEach((node, index) => {
      const offset = (index - (siblings.length - 1) / 2) * spread;
      const angle = parentAngle + offset;
      node.anchorX = (parent.anchorX ?? geo.cx) + Math.cos(angle) * radius;
      node.anchorY = (parent.anchorY ?? geo.cy) + Math.sin(angle) * radius;
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

function renderNow(runtime: HomeRuntime) {
  if (!runtime.linkSelection || !runtime.nodeSelection) return;
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

function ensureSimulation(runtime: HomeRuntime): Simulation<GraphNode, GraphLink> {
  if (runtime.simulation) return runtime.simulation;
  runtime.simulation = forceSimulation<GraphNode, GraphLink>(runtime.nodes)
    .stop()
    .alphaDecay(0.02)
    .velocityDecay(0.7)
    .on('tick', () => renderNow(runtime));
  return runtime.simulation;
}

function configureForces(runtime: HomeRuntime, geo: Geometry) {
  if (!runtime.simulation) return;
  const anchorStrength = geo.compact ? 0.5 : 0.32;
  const collideScale = geo.compact ? 0.6 : 1;
  runtime.simulation
    .force(
      'link',
      forceLink<GraphNode, GraphLink>(runtime.links)
        .id((node) => node.id)
        .distance((link) =>
          link.type === 'primary' ? geo.primaryDistance : geo.childDistance
        )
        .strength((link) => (link.type === 'primary' ? 0.7 : 0.6))
        .iterations(2)
    )
    .force(
      'charge',
      forceManyBody<GraphNode>()
        .strength((node) =>
          node.type === 'root'
            ? (geo.compact ? -200 : -380)
            : (geo.compact ? -25 : -55)
        )
        .distanceMax(geo.compact ? 250 : 400)
    )
    .force(
      'collide',
      forceCollide<GraphNode>()
        .radius((node) => nodeRadius(node) * collideScale)
        .strength(0.7)
        .iterations(3)
    )
    .force(
      'x',
      forceX<GraphNode>((node) => node.anchorX ?? 0).strength((node) =>
        node.type === 'root' ? 1 : anchorStrength
      )
    )
    .force(
      'y',
      forceY<GraphNode>((node) => node.anchorY ?? 0).strength((node) =>
        node.type === 'root' ? 1 : anchorStrength
      )
    )
    .force(
      'bounds',
      geo.compact
        ? () => {
            const padX = 60;
            const padY = 30;
            for (const node of runtime.nodes) {
              if (node.type === 'root') continue;
              node.x = clamp(node.x!, padX, geo.width - padX);
              node.y = clamp(node.y!, padY, geo.height - padY);
            }
          }
        : null
    );
}

function settle(runtime: HomeRuntime, { alpha, warmupTicks }: { alpha: number; warmupTicks: number }) {
  const geo = readGeometry(runtime);
  computeAnchors(runtime, geo);
  seedPositions(runtime);
  const sim = ensureSimulation(runtime);

  if (reduceMotion.matches) {
    runtime.nodes.forEach((node) => {
      node.x = node.anchorX;
      node.y = node.anchorY;
    });
    renderNow(runtime);
    return;
  }

  configureForces(runtime, geo);
  sim.alpha(alpha).alphaTarget(0);
  if (warmupTicks > 0) sim.tick(warmupTicks);
  renderNow(runtime);
  sim.restart();
}

function buildSelections(runtime: HomeRuntime) {
  const svg = select(runtime.graphSvg);
  const linkLayer = svg.select<SVGGElement>('.graph-links');
  const nodeLayer = svg.select<SVGGElement>('.graph-nodes');

  const nodesById = new Map(runtime.nodes.map((node) => [node.id, node]));
  const linkRevealIndex = (link: GraphLink): number => {
    if (link.type !== 'child') return 0;
    const target = nodesById.get(refId(link.target));
    return target?.revealIndex ?? 0;
  };

  runtime.linkSelection = linkLayer
    .selectAll<SVGLineElement, GraphLink>('line')
    .data(runtime.links, (link) => `${refId(link.source)}-${refId(link.target)}`)
    .join('line')
    .attr('class', (link) => `graph-link graph-link--${link.type}`)
    .style('--reveal-index', (link) => String(linkRevealIndex(link)))
    .classed('is-visible', (link) => link.type === 'primary');

  const interactive = runtime.nodes.filter((node) => node.type !== 'root');
  runtime.nodeSelection = nodeLayer
    .selectAll<SVGGElement, GraphNode>('g')
    .data(interactive, (node) => node.id)
    .join((enter) => {
      const group = enter
        .append('g')
        .attr('class', (node) => `graph-node graph-node--${node.type}`)
        .attr('data-graph-node', (node) => node.id)
        .style('--reveal-index', (node) => String(node.revealIndex));
      group.each(function appendNodeContent(node) {
        const target = select(this)
          .append(node.href ? 'a' : 'g')
          .attr('class', 'graph-node-target');

        if (node.href) {
          target
            .attr('href', node.href)
            .attr('aria-label', node.label);
        }

        target
          .append('rect')
          .attr('class', 'graph-hit-area')
          .attr('x', -hitWidth(node) / 2)
          .attr('y', -10)
          .attr('width', hitWidth(node))
          .attr('height', hitHeight(node))
          .attr('rx', 3);
        target.append('circle').attr('class', 'graph-dot').attr('r', dotRadius(node));
        target
          .append('text')
          .attr('class', 'graph-label')
          .attr('text-anchor', 'middle')
          .attr('y', labelOffset(node))
          .text(node.label);

        if (node.type === 'category' && node.childCount && node.childCount > 0) {
          target
            .append('text')
            .attr('class', 'graph-count')
            .attr('text-anchor', 'middle')
            .attr('y', labelOffset(node) + 14)
            .text(toRomanNumeral(node.childCount));
        }
      });
      return group;
    });

  runtime.nodeSelection
    .attr('role', (node) => (node.type === 'category' ? 'button' : null))
    .attr('tabindex', (node) => (node.type === 'category' ? '0' : null))
    .attr('aria-expanded', (node) => (node.type === 'category' ? 'false' : null))
    .on('click', (_, node) => {
      if (!node.href) setActiveBranch(runtime, runtime.activeBranch === node.id ? null : node.id);
    })
    .on('keydown', (event, node) => {
      if (node.href) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      setActiveBranch(runtime, runtime.activeBranch === node.id ? null : node.id);
    });
}

function initializeGraph(runtime: HomeRuntime) {
  const data = parseGraphData(runtime);
  if (!data) return;

  const childIndexByParent = new Map<string, number>();
  runtime.nodes = data.nodes.map((node) => {
    let revealIndex = 0;
    if (node.type === 'project' && node.parentId) {
      const next = childIndexByParent.get(node.parentId) ?? 0;
      revealIndex = next;
      childIndexByParent.set(node.parentId, next + 1);
    }
    return {
      ...node,
      revealIndex
    };
  });
  runtime.links = data.links.map((link) => ({ ...link }));

  buildSelections(runtime);
  setActiveBranch(runtime, null);
  updateViewport(runtime);
  settle(runtime, { alpha: 0.5, warmupTicks: 150 });

  const handleResize = () => {
    if (runtime.resizeRaf) cancelAnimationFrame(runtime.resizeRaf);
    runtime.resizeRaf = requestAnimationFrame(() => {
      runtime.resizeRaf = 0;
      updateViewport(runtime);
      settle(runtime, { alpha: 0.15, warmupTicks: 8 });
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

  nextRuntime.skipButton?.addEventListener('click', () => skipIntroForSession(nextRuntime), {
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
