export function renderProjectPage(projectsJson: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ottavia Farchi</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" href="/favicon.ico">
<link rel="stylesheet" href="/styles/project.css">
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

<script id="project-data" type="application/json">${projectsJson}</script>
<script src="/scripts/project.js"></script>
</body>
</html>
`;
}
