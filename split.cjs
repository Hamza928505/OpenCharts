const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The new navigation block
const newNav = `  <nav aria-label="Main navigation">
    <a class="nav-link" href="documentation.html">How it works</a>
    <a class="nav-link" href="index.html">Charts</a>
    <a class="nav-link" href="ai.html">AI Assistant</a>
    <a class="btn btn-sm btn-primary" href="studio.html">Open studio</a>
    <span id="theme-mount"></span>
  </nav>`;

html = html.replace(/<nav[^>]*>([\s\S]*?)<\/nav>/, newNav);

// Extract sections
const heroRegex = /<section class="gallery-hero"[^>]*>[\s\S]*?<\/section>/;
const matchbarRegex = /<section class="matchbar"[\s\S]*?<\/section>\s*<\/section>/; // Matchbar has a nested section, need to be careful
const matchbarContent = html.substring(html.indexOf('<section class="matchbar" id="matchbar">'), html.indexOf('<!-- What this reader kept.'));

const shelfRegex = /<section class="shelf"[^>]*>[\s\S]*?<\/section>/;
const libraryRegex = /<div class="toolbar" id="library">[\s\S]*?<\/div>/;
const gridRegex = /<div class="grid" id="grid"[^>]*><\/div>/;
const stepsRegex = /<section class="home-steps"[^>]*>[\s\S]*?<\/section>/;
const connectRegex = /<section class="home-connect"[^>]*>[\s\S]*?<\/section>/;

// Write index.html (Charts & Hero & Shelf)
let indexHtml = html
  .replace(matchbarContent, '')
  .replace(stepsRegex, '')
  .replace(connectRegex, '');
fs.writeFileSync('index.html', indexHtml);

// Write ai.html (Matchbar)
let aiHtml = html
  .replace(heroRegex, '<div style="padding-top: 60px;"></div>')
  .replace(shelfRegex, '')
  .replace(libraryRegex, '')
  .replace(gridRegex, '')
  .replace(stepsRegex, '')
  .replace(connectRegex, '')
  .replace('<title>OpenCharts — Make a chart you can keep</title>', '<title>AI Assistant — OpenCharts</title>');
fs.writeFileSync('ai.html', aiHtml);

// Write documentation.html (Steps & Connect)
let docsHtml = html
  .replace(heroRegex, '<div style="padding-top: 60px;"></div>')
  .replace(matchbarContent, '')
  .replace(shelfRegex, '')
  .replace(libraryRegex, '')
  .replace(gridRegex, '')
  .replace('<title>OpenCharts — Make a chart you can keep</title>', '<title>Documentation — OpenCharts</title>');
fs.writeFileSync('documentation.html', docsHtml);

console.log('Files split successfully.');
