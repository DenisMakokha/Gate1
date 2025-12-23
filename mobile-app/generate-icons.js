const fs = require('fs');
const path = require('path');

// Create assets directory if it doesn't exist
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Gate 1 System Icon - A modern camera/media management icon with "G1" branding
// Main icon (1024x1024) - Blue gradient background with camera lens and G1 text
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4f46e5"/>
      <stop offset="50%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#818cf8"/>
    </linearGradient>
    <linearGradient id="lensGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e1b4b"/>
      <stop offset="100%" style="stop-color:#312e81"/>
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#c7d2fe"/>
      <stop offset="100%" style="stop-color:#a5b4fc"/>
    </linearGradient>
  </defs>
  
  <!-- Background with rounded corners -->
  <rect width="1024" height="1024" rx="220" fill="url(#bgGrad)"/>
  
  <!-- Subtle pattern overlay -->
  <circle cx="200" cy="200" r="400" fill="rgba(255,255,255,0.03)"/>
  <circle cx="824" cy="824" r="300" fill="rgba(255,255,255,0.03)"/>
  
  <!-- Camera body outline -->
  <rect x="180" y="320" width="664" height="450" rx="60" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="4"/>
  
  <!-- Camera lens outer ring -->
  <circle cx="512" cy="520" r="180" fill="url(#lensGrad)" stroke="rgba(255,255,255,0.4)" stroke-width="8"/>
  
  <!-- Camera lens middle ring -->
  <circle cx="512" cy="520" r="140" fill="#1e1b4b" stroke="rgba(255,255,255,0.2)" stroke-width="4"/>
  
  <!-- Camera lens inner -->
  <circle cx="512" cy="520" r="100" fill="#0f0a2e"/>
  
  <!-- Lens reflection/highlight -->
  <ellipse cx="470" cy="480" rx="35" ry="25" fill="rgba(255,255,255,0.3)" transform="rotate(-30 470 480)"/>
  <ellipse cx="540" cy="550" rx="20" ry="15" fill="rgba(255,255,255,0.15)" transform="rotate(-30 540 550)"/>
  
  <!-- Camera flash -->
  <rect x="680" y="360" width="80" height="50" rx="10" fill="rgba(255,255,255,0.25)"/>
  
  <!-- G1 Text Badge -->
  <rect x="340" y="720" width="344" height="120" rx="30" fill="rgba(255,255,255,0.95)"/>
  <text x="512" y="805" font-family="Arial Black, Arial, sans-serif" font-size="90" font-weight="900" fill="#4f46e5" text-anchor="middle">G1</text>
  
  <!-- Small decorative elements -->
  <circle cx="260" cy="380" r="20" fill="rgba(255,255,255,0.3)"/>
  <rect x="300" y="375" width="60" height="10" rx="5" fill="rgba(255,255,255,0.2)"/>
</svg>`;

// Adaptive icon foreground (transparent background, just the icon elements)
const adaptiveIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="lensGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e1b4b"/>
      <stop offset="100%" style="stop-color:#312e81"/>
    </linearGradient>
  </defs>
  
  <!-- Camera body outline -->
  <rect x="220" y="340" width="584" height="400" rx="50" fill="rgba(255,255,255,0.9)" stroke="#4f46e5" stroke-width="8"/>
  
  <!-- Camera lens outer ring -->
  <circle cx="512" cy="520" r="160" fill="url(#lensGrad2)" stroke="#6366f1" stroke-width="8"/>
  
  <!-- Camera lens middle ring -->
  <circle cx="512" cy="520" r="120" fill="#1e1b4b" stroke="rgba(99,102,241,0.5)" stroke-width="4"/>
  
  <!-- Camera lens inner -->
  <circle cx="512" cy="520" r="80" fill="#0f0a2e"/>
  
  <!-- Lens reflection -->
  <ellipse cx="475" cy="485" rx="30" ry="20" fill="rgba(255,255,255,0.4)" transform="rotate(-30 475 485)"/>
  
  <!-- Camera flash -->
  <rect x="650" y="375" width="70" height="45" rx="8" fill="#a5b4fc"/>
  
  <!-- G1 Text -->
  <text x="512" y="800" font-family="Arial Black, Arial, sans-serif" font-size="100" font-weight="900" fill="#4f46e5" text-anchor="middle">G1</text>
  
  <!-- Recording indicator -->
  <circle cx="280" cy="390" r="15" fill="#ef4444"/>
</svg>`;

// Splash screen (simple centered logo)
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1284" height="2778" viewBox="0 0 1284 2778">
  <defs>
    <linearGradient id="splashBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4f46e5"/>
      <stop offset="100%" style="stop-color:#6366f1"/>
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="1284" height="2778" fill="url(#splashBg)"/>
  
  <!-- Centered Camera Icon -->
  <g transform="translate(392, 1089)">
    <!-- Camera body -->
    <rect x="50" y="100" width="400" height="280" rx="40" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="4"/>
    
    <!-- Camera lens -->
    <circle cx="250" cy="230" r="100" fill="#1e1b4b" stroke="rgba(255,255,255,0.4)" stroke-width="6"/>
    <circle cx="250" cy="230" r="70" fill="#0f0a2e"/>
    <ellipse cx="225" cy="205" rx="20" ry="15" fill="rgba(255,255,255,0.3)" transform="rotate(-30 225 205)"/>
    
    <!-- Flash -->
    <rect x="370" y="130" width="50" height="35" rx="8" fill="rgba(255,255,255,0.25)"/>
    
    <!-- G1 Text -->
    <text x="250" y="480" font-family="Arial Black, Arial, sans-serif" font-size="80" font-weight="900" fill="white" text-anchor="middle">GATE 1</text>
    <text x="250" y="550" font-family="Arial, sans-serif" font-size="30" fill="rgba(255,255,255,0.7)" text-anchor="middle">Media Management System</text>
  </g>
</svg>`;

// Favicon (simple small icon)
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <defs>
    <linearGradient id="favBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4f46e5"/>
      <stop offset="100%" style="stop-color:#6366f1"/>
    </linearGradient>
  </defs>
  <rect width="48" height="48" rx="10" fill="url(#favBg)"/>
  <circle cx="24" cy="22" r="10" fill="#1e1b4b" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
  <circle cx="24" cy="22" r="6" fill="#0f0a2e"/>
  <text x="24" y="42" font-family="Arial Black, Arial, sans-serif" font-size="10" font-weight="900" fill="white" text-anchor="middle">G1</text>
</svg>`;

// Save SVG files
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), iconSvg);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.svg'), adaptiveIconSvg);
fs.writeFileSync(path.join(assetsDir, 'splash.svg'), splashSvg);
fs.writeFileSync(path.join(assetsDir, 'favicon.svg'), faviconSvg);

console.log('SVG icons created successfully in assets folder!');
console.log('');
console.log('To convert to PNG, you can use one of these methods:');
console.log('1. Online: Use https://svgtopng.com/ or https://cloudconvert.com/svg-to-png');
console.log('2. Install sharp: npm install sharp, then run the conversion script');
console.log('');
console.log('Required PNG sizes:');
console.log('- icon.png: 1024x1024');
console.log('- adaptive-icon.png: 1024x1024');
console.log('- splash.png: 1284x2778');
console.log('- favicon.png: 48x48');
