const videoIntro = document.getElementById('video-intro');
const video = document.getElementById('intro-video');
const skipButton = document.getElementById('skip-btn');
const hintText = document.getElementById('hint-text');
const pageTransition = document.getElementById('page-transition');
const branches = Array.from(document.querySelectorAll<HTMLElement>('[data-branch]'));
const branchButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-branch-toggle]'));
const pageLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-page-link]'));

let activeBranchId: string | null = null;
let introFinished = false;

function setActiveBranch(branchId: string | null) {
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

function navigateTo(url: string) {
  if (pageTransition) {
    pageTransition.classList.add('active');
  }

  window.setTimeout(() => {
    window.location.href = url;
  }, 800);
}

function finishIntro() {
  if (introFinished) {
    return;
  }

  introFinished = true;

  if (videoIntro) {
    videoIntro.classList.add('is-finished');
  }

  window.setTimeout(() => {
    if (videoIntro) {
      videoIntro.remove();
    }

    if (video instanceof HTMLVideoElement) {
      video.pause();
    }
  }, 1600);
}

document.body.classList.add('js-enabled');

branchButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const branch = button.closest<HTMLElement>('[data-branch]');
    const branchId = branch?.dataset.branch ?? null;

    setActiveBranch(activeBranchId === branchId ? null : branchId);
  });
});

pageLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
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
  video.play().catch(finishIntro);
  video.addEventListener('ended', finishIntro, { once: true });
} else {
  finishIntro();
}

if (skipButton instanceof HTMLButtonElement) {
  skipButton.addEventListener('click', finishIntro);
}
