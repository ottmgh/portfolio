const treeDataElement = document.getElementById('tree-data');
const treeData = treeDataElement ? JSON.parse(treeDataElement.textContent || '{}') : { branches: [] };

const videoIntro = document.getElementById('video-intro');
const video = document.getElementById('intro-video');
const progress = document.getElementById('video-progress');
const skipBtn = document.getElementById('skip-btn');
const treeView = document.getElementById('tree-view');
const lastFrame = document.getElementById('video-last-frame');
const treeContainer = document.getElementById('tree-container');
const svg = document.getElementById('tree-lines');
const hintText = document.getElementById('hint-text');
const pageTransition = document.getElementById('page-transition');
const rootNode = document.getElementById('root');

const centerX = window.innerWidth / 2;
const centerY = window.innerHeight / 2;

let branchesShown = false;
let activeBranchId = null;
let subBranchElements = [];
let lineElements = [];

svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function captureLastFrame() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.drawImage(video, 0, 0);
    lastFrame.style.backgroundImage = `url(${canvas.toDataURL()})`;
    lastFrame.classList.add('visible');
  } catch {
    // Ignore capture failures and keep the dark fallback background.
  }
}

function createLine(x1, y1, x2, y2, isSubBranch = false) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x1);
  line.setAttribute('y2', y1);
  if (isSubBranch) {
    line.dataset.sub = 'true';
  }
  svg.appendChild(line);

  requestAnimationFrame(() => {
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.classList.add('visible');
  });

  lineElements.push(line);
  return line;
}

function clearSubBranches() {
  subBranchElements.forEach((element) => {
    element.classList.remove('visible');
    window.setTimeout(() => element.remove(), 800);
  });

  lineElements
    .filter((line) => line.dataset.sub === 'true')
    .forEach((line) => {
      line.classList.remove('visible');
      window.setTimeout(() => line.remove(), 800);
    });

  lineElements = lineElements.filter((line) => line.dataset.sub !== 'true');
  subBranchElements = [];
  activeBranchId = null;
}

function navigateTo(url) {
  pageTransition.classList.add('active');
  window.setTimeout(() => {
    window.location.href = url;
  }, 800);
}

function toggleSubBranches(branch, branchX, branchY) {
  if (activeBranchId === branch.id) {
    clearSubBranches();
    return;
  }

  clearSubBranches();
  activeBranchId = branch.id;

  if (!branch.children || branch.children.length === 0) {
    return;
  }

  const spread = 40;
  const subDistance = 120;
  const startAngle = branch.angle - ((branch.children.length - 1) * spread) / 2;

  branch.children.forEach((child, index) => {
    window.setTimeout(() => {
      const angle = startAngle + index * spread;
      const radians = toRadians(angle);
      const childX = branchX + Math.cos(radians) * subDistance;
      const childY = branchY + Math.sin(radians) * subDistance;

      createLine(branchX, branchY, childX, childY, true);

      const node = document.createElement('a');
      node.className = 'sub-branch';
      node.href = child.page;
      node.style.left = `${childX}px`;
      node.style.top = `${childY}px`;
      node.style.transform = 'translate(-50%, -50%) scale(0.2)';
      node.innerHTML = `
        <div class="sub-dot"></div>
        <div class="sub-label">${child.label}</div>
      `;
      node.addEventListener('click', (event) => {
        event.preventDefault();
        navigateTo(child.page);
      });

      treeContainer.appendChild(node);
      requestAnimationFrame(() => {
        node.classList.add('visible');
        node.style.transform = 'translate(-50%, -50%) scale(1)';
      });

      subBranchElements.push(node);
    }, index * 200);
  });

  hintText.style.opacity = '0';
}

function showBranches() {
  if (branchesShown) {
    return;
  }

  branchesShown = true;

  treeData.branches.forEach((branch, index) => {
    window.setTimeout(() => {
      const radians = toRadians(branch.angle);
      const branchX = centerX + Math.cos(radians) * branch.distance;
      const branchY = centerY + Math.sin(radians) * branch.distance;

      createLine(centerX, centerY, branchX, branchY);

      const node = document.createElement('div');
      node.className = 'branch-node';
      node.style.left = `${branchX}px`;
      node.style.top = `${branchY}px`;
      node.style.transform = 'translate(-50%, -50%) scale(0.3)';
      node.innerHTML = `
        <div class="branch-dot"></div>
        <div class="branch-label">${branch.label}</div>
      `;
      node.addEventListener('click', () => toggleSubBranches(branch, branchX, branchY));

      treeContainer.appendChild(node);
      requestAnimationFrame(() => {
        node.classList.add('visible');
        node.style.transform = 'translate(-50%, -50%) scale(1)';
      });
    }, index * 300);
  });
}

function transitionToTree() {
  captureLastFrame();
  videoIntro.classList.add('fading');
  treeView.classList.add('visible');

  window.setTimeout(() => {
    videoIntro.style.display = 'none';
    video.pause();
    document.body.style.overflow = 'hidden';
    showBranches();
  }, 1800);
}

function createParticles() {
  for (let i = 0; i < 40; i += 1) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.animationDuration = `${8 + Math.random() * 15}s`;
    particle.style.animationDelay = `${Math.random() * 10}s`;
    const size = 1 + Math.random() * 2;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    treeView.appendChild(particle);
  }
}

createParticles();

video.play().catch(() => {
  transitionToTree();
});

video.addEventListener('timeupdate', () => {
  if (!video.duration) {
    return;
  }

  progress.style.width = `${(video.currentTime / video.duration) * 100}%`;
});

video.addEventListener('ended', transitionToTree);
skipBtn.addEventListener('click', transitionToTree);

rootNode.addEventListener('click', () => {
  if (!branchesShown) {
    showBranches();
  }
});

window.addEventListener('resize', () => {
  window.location.reload();
});
