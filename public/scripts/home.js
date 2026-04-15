const videoIntro = document.getElementById('video-intro');
const video = document.getElementById('intro-video');
const progress = document.getElementById('video-progress');
const skipButton = document.getElementById('skip-btn');
const treeView = document.getElementById('tree-view');
const lastFrame = document.getElementById('video-last-frame');
const hintText = document.getElementById('hint-text');
const pageTransition = document.getElementById('page-transition');
const branches = [...document.querySelectorAll('[data-branch]')];
const branchButtons = [...document.querySelectorAll('[data-branch-toggle]')];
const pageLinks = [...document.querySelectorAll('[data-page-link]')];

let activeBranchId = null;
let introComplete = false;

function captureLastFrame() {
  if (!(video instanceof HTMLVideoElement) || !lastFrame) {
    return;
  }

  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return;
  }

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
  } catch {
    // Ignore capture failures and keep the static background fallback.
  }
}

function setActiveBranch(branchId) {
  activeBranchId = branchId;

  branches.forEach((branch) => {
    const isActive = branch.dataset.branch === branchId;
    const button = branch.querySelector('[data-branch-toggle]');

    branch.classList.toggle('is-active', isActive);

    if (button instanceof HTMLButtonElement) {
      button.setAttribute('aria-expanded', String(isActive));
    }
  });

  if (hintText) {
    hintText.classList.toggle('is-hidden', Boolean(branchId));
  }
}

function navigateTo(url) {
  if (pageTransition) {
    pageTransition.classList.add('active');
  }

  window.setTimeout(() => {
    window.location.href = url;
  }, 800);
}

function transitionToTree() {
  if (introComplete) {
    return;
  }

  introComplete = true;
  captureLastFrame();
  document.body.classList.add('intro-complete');

  if (videoIntro) {
    videoIntro.classList.add('fading');
  }

  if (treeView) {
    treeView.classList.add('visible');
  }

  window.setTimeout(() => {
    if (videoIntro) {
      videoIntro.hidden = true;
    }

    if (video instanceof HTMLVideoElement) {
      video.pause();
    }
  }, 1600);
}

document.body.classList.add('js-enabled');

branchButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const branch = button.closest('[data-branch]');
    const branchId = branch?.dataset.branch ?? null;

    setActiveBranch(activeBranchId === branchId ? null : branchId);
  });
});

pageLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    const isModifiedClick =
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0;

    if (isModifiedClick || link.target === '_blank') {
      return;
    }

    event.preventDefault();
    navigateTo(link.href);
  });
});

if (video instanceof HTMLVideoElement) {
  const playPromise = video.play();

  if (playPromise) {
    playPromise.catch(() => {
      transitionToTree();
    });
  }

  video.addEventListener('timeupdate', () => {
    if (!progress || !video.duration) {
      return;
    }

    progress.style.width = `${(video.currentTime / video.duration) * 100}%`;
  });

  video.addEventListener('ended', transitionToTree);
} else {
  transitionToTree();
}

if (skipButton instanceof HTMLButtonElement) {
  skipButton.addEventListener('click', transitionToTree);
}
