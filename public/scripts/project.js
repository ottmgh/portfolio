const projectDataElement = document.getElementById('project-data');
const projects = projectDataElement ? JSON.parse(projectDataElement.textContent || '{}') : {};

const params = new URLSearchParams(window.location.search);
const projectId = params.get('id') || '1';
const project = projects[projectId] || projects['1'];

document.title = `${project.title} — Ottavia Farchi`;
document.getElementById('project-title-header').textContent = project.title;
document.getElementById('project-meta-header').textContent = `${project.category} — ${project.year}`;
document.getElementById('project-description').textContent = project.description;

const detailsEl = document.getElementById('project-details');
let detailsHtml = '';
for (const [key, val] of Object.entries(project.details)) {
  detailsHtml += `${key.toUpperCase()} <span>${val}</span><br>`;
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
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.05 });
observer.observe(infoContent);

for (let i = 0; i < 20; i += 1) {
  const particle = document.createElement('div');
  particle.className = 'particle';
  particle.style.left = `${Math.random() * 100}%`;
  particle.style.animationDuration = `${10 + Math.random() * 15}s`;
  particle.style.animationDelay = `${Math.random() * 10}s`;
  document.body.appendChild(particle);
}
