import { getCollection } from 'astro:content';

export const prerender = true;

export async function GET() {
  const projectEntries = (await getCollection('projects')).sort(
    (left, right) => left.data.sortOrder - right.data.sortOrder
  );

  const projects = Object.fromEntries(
    projectEntries.map((entry) => [
      String(entry.data.sortOrder),
      {
        title: entry.data.title,
        category: entry.data.category,
        year: String(entry.data.year),
        video: entry.data.video ?? '/media/videos/ott.mp4',
        description: entry.data.description,
        details: {
          format: entry.data.format ?? '',
          duration: entry.data.duration ?? '',
          year: String(entry.data.year),
          status: entry.data.status ?? ''
        }
      }
    ])
  );

  const projectsJson = JSON.stringify(projects).replace(/</g, '\\u003c');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ottavia Farchi</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Space+Mono:wght@400;700&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
background: #0a0a0a;
color: #e8e4df;
font-family: 'Cormorant Garamond', serif;
overflow-x: hidden;
}

.page-enter {
animation: fadeIn 1.2s ease forwards;
}

@keyframes fadeIn {
from { opacity: 0; }
to { opacity: 1; }
}

.back-link {
position: fixed;
top: 30px;
left: 30px;
font-family: 'Space Mono', monospace;
font-size: 0.6rem;
letter-spacing: 3px;
text-transform: uppercase;
color: rgba(255,255,255,0.25);
text-decoration: none;
z-index: 100;
transition: color 0.4s ease;
display: flex;
align-items: center;
gap: 8px;
}

.back-link:hover {
color: rgba(255,255,255,0.7);
}

.back-arrow {
width: 20px;
height: 1px;
background: rgba(255,255,255,0.25);
position: relative;
transition: background 0.4s ease;
}

.back-link:hover .back-arrow {
background: rgba(255,255,255,0.7);
}

.back-arrow::before {
content: '';
position: absolute;
left: 0;
top: -3px;
width: 7px;
height: 7px;
border-left: 1px solid rgba(255,255,255,0.25);
border-bottom: 1px solid rgba(255,255,255,0.25);
transform: rotate(45deg);
transition: border-color 0.4s ease;
}

.back-link:hover .back-arrow::before {
border-color: rgba(255,255,255,0.7);
}

.video-section {
width: 100%;
min-height: 100vh;
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
position: relative;
padding: 80px 40px 60px;
}

.video-header {
text-align: center;
margin-bottom: 30px;
opacity: 0;
animation: fadeSlideIn 1.2s ease 0.3s forwards;
}

@keyframes fadeSlideIn {
from { opacity: 0; transform: translateY(15px); }
to { opacity: 1; transform: translateY(0); }
}

.video-header .project-title {
font-family: 'Cormorant Garamond', serif;
font-weight: 300;
font-size: clamp(1.8rem, 4vw, 3rem);
letter-spacing: 6px;
color: #e8e4df;
margin-bottom: 8px;
}

.video-header .project-meta {
font-family: 'Space Mono', monospace;
font-size: 0.6rem;
letter-spacing: 4px;
text-transform: uppercase;
color: rgba(255,255,255,0.35);
}

.video-wrapper {
width: 85%;
max-width: 1000px;
position: relative;
}

.video-wrapper video {
width: 100%;
display: block;
opacity: 0;
transition: opacity 1s ease 0.5s;
}

.video-wrapper video.loaded {
opacity: 1;
}

.video-border {
position: absolute;
inset: -1px;
border: 1px solid rgba(255,255,255,0.06);
pointer-events: none;
}

.info-section {
min-height: 40vh;
display: flex;
align-items: flex-start;
justify-content: center;
padding: 60px 40px 120px;
}

.info-content {
max-width: 700px;
width: 100%;
opacity: 0;
transform: translateY(20px);
transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);
}

.info-content.visible {
opacity: 1;
transform: translateY(0);
}

.info-title {
font-family: 'Cormorant Garamond', serif;
font-weight: 300;
font-size: clamp(1.4rem, 3vw, 2rem);
letter-spacing: 3px;
margin-bottom: 30px;
color: rgba(255,255,255,0.4);
display: none;
}

.project-description {
font-family: 'Cormorant Garamond', serif;
font-weight: 300;
font-size: 1.25rem;
line-height: 2;
color: rgba(255,255,255,0.75);
max-width: 600px;
}

.divider {
width: 40px;
height: 1px;
background: rgba(255,255,255,0.2);
margin: 40px 0;
}

.project-details {
font-family: 'Space Mono', monospace;
font-size: 0.65rem;
letter-spacing: 2px;
color: rgba(255,255,255,0.3);
line-height: 2.5;
}

.project-details span {
color: rgba(255,255,255,0.55);
}

.particle {
position: fixed;
width: 2px;
height: 2px;
background: rgba(255,255,255,0.04);
border-radius: 50%;
animation: drift linear infinite;
pointer-events: none;
}

@keyframes drift {
0% { transform: translateY(100vh) scale(0); opacity: 0; }
10% { opacity: 1; }
90% { opacity: 1; }
100% { transform: translateY(-10vh) scale(1); opacity: 0; }
}

.scroll-indicator {
position: absolute;
bottom: 40px;
left: 50%;
transform: translateX(-50%);
font-family: 'Space Mono', monospace;
font-size: 0.55rem;
letter-spacing: 4px;
color: rgba(255,255,255,0.12);
text-transform: uppercase;
animation: breathe 3s ease-in-out infinite;
}

@keyframes breathe {
0%, 100% { opacity: 0.12; }
50% { opacity: 0.3; }
}
</style>
</head>
<body class="page-enter">

<a href="index.html" class="back-link">
<span class="back-arrow"></span>
back
</a>

<section class="video-section">
<div class="video-header">
<h1 class="project-title" id="project-title-header"></h1>
<div class="project-meta" id="project-meta-header"></div>
</div>
<div class="video-wrapper">
<video id="project-video" controls playsinline>
<source src="" type="video/mp4">
</video>
<div class="video-border"></div>
</div>
<div class="scroll-indicator">scroll</div>
</section>

<section class="info-section">
<div class="info-content" id="info-content">
<p class="project-description" id="project-description"></p>
<div class="divider"></div>
<div class="project-details" id="project-details"></div>
</div>
</section>

<script>
const projects = ${projectsJson};

const params = new URLSearchParams(window.location.search);
const projectId = params.get('id') || '1';
const project = projects[projectId] || projects['1'];

document.title = project.title + ' — Ottavia Farchi';
document.getElementById('project-title-header').textContent = project.title;
document.getElementById('project-meta-header').textContent = project.category + ' — ' + project.year;
document.getElementById('project-description').textContent = project.description;

const detailsEl = document.getElementById('project-details');
let detailsHtml = '';
for (const [key, val] of Object.entries(project.details)) {
detailsHtml += key.toUpperCase() + ' <span>' + val + '</span><br>';
}
detailsEl.innerHTML = detailsHtml;

const videoEl = document.getElementById('project-video');
videoEl.querySelector('source').src = project.video;
videoEl.load();
videoEl.addEventListener('loadeddata', () => {
videoEl.classList.add('loaded');
});

const infoContent = document.getElementById('info-content');
const observer = new IntersectionObserver((entries) => {
entries.forEach(entry => {
if (entry.isIntersecting) {
entry.target.classList.add('visible');
}
});
}, { threshold: 0.05 });
observer.observe(infoContent);

for (let i = 0; i < 20; i++) {
const p = document.createElement('div');
p.className = 'particle';
p.style.left = Math.random() * 100 + '%';
p.style.animationDuration = (10 + Math.random() * 15) + 's';
p.style.animationDelay = (Math.random() * 10) + 's';
document.body.appendChild(p);
}
</script>
</body>
</html>
`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
}
