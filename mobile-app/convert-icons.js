const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');

async function convertIcons() {
  try {
    // Convert icon.svg to icon.png (1024x1024)
    console.log('Converting icon.svg...');
    await sharp(path.join(assetsDir, 'icon.svg'))
      .resize(1024, 1024)
      .png()
      .toFile(path.join(assetsDir, 'icon.png'));
    console.log('✓ icon.png created (1024x1024)');

    // Convert adaptive-icon.svg to adaptive-icon.png (1024x1024)
    console.log('Converting adaptive-icon.svg...');
    await sharp(path.join(assetsDir, 'adaptive-icon.svg'))
      .resize(1024, 1024)
      .png()
      .toFile(path.join(assetsDir, 'adaptive-icon.png'));
    console.log('✓ adaptive-icon.png created (1024x1024)');

    // Convert splash.svg to splash.png (1284x2778)
    console.log('Converting splash.svg...');
    await sharp(path.join(assetsDir, 'splash.svg'))
      .resize(1284, 2778)
      .png()
      .toFile(path.join(assetsDir, 'splash.png'));
    console.log('✓ splash.png created (1284x2778)');

    // Convert favicon.svg to favicon.png (48x48)
    console.log('Converting favicon.svg...');
    await sharp(path.join(assetsDir, 'favicon.svg'))
      .resize(48, 48)
      .png()
      .toFile(path.join(assetsDir, 'favicon.png'));
    console.log('✓ favicon.png created (48x48)');

    console.log('\n✅ All icons converted successfully!');
  } catch (error) {
    console.error('Error converting icons:', error);
  }
}

convertIcons();
