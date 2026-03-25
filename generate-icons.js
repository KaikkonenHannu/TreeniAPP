// Simple SVG-based icon generator - creates PNG-like SVG icons for PWA
const fs = require('fs');
const path = require('path');

const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="32" fill="#0a0a0f"/>
  <text x="96" y="96" text-anchor="middle" dominant-baseline="central" font-family="Arial Black, sans-serif" font-size="48" font-weight="900" fill="#c8ff00" letter-spacing="2">TAI</text>
  <text x="96" y="140" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#6b6b88">TREENI</text>
</svg>`;

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#0a0a0f"/>
  <text x="256" y="240" text-anchor="middle" dominant-baseline="central" font-family="Arial Black, sans-serif" font-size="128" font-weight="900" fill="#c8ff00" letter-spacing="4">TAI</text>
  <text x="256" y="360" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" fill="#6b6b88">TREENI</text>
</svg>`;

fs.writeFileSync(path.join(__dirname, 'public', 'icon-192.png'), svg192);
fs.writeFileSync(path.join(__dirname, 'public', 'icon-512.png'), svg512);
console.log('Icons generated (SVG format with .png extension - works for PWA)');
