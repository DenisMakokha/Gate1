const sharp = require('sharp');
const bmp = require('bmp-js');
const fs = require('fs');
const path = require('path');

async function pngToBmp24(pngPath, bmpPath) {
  // Get raw RGB data (no alpha)
  const { data, info } = await sharp(pngPath)
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // White background for transparency
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const width = info.width;
  const height = info.height;
  
  // BMP row padding (rows must be multiple of 4 bytes)
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelDataSize = rowSize * height;
  
  // BMP file header (14 bytes) + DIB header (40 bytes) + pixel data
  const fileSize = 54 + pixelDataSize;
  const buffer = Buffer.alloc(fileSize);
  
  // BMP File Header (14 bytes)
  buffer.write('BM', 0);                    // Signature
  buffer.writeUInt32LE(fileSize, 2);        // File size
  buffer.writeUInt32LE(0, 6);               // Reserved
  buffer.writeUInt32LE(54, 10);             // Pixel data offset
  
  // DIB Header (BITMAPINFOHEADER - 40 bytes)
  buffer.writeUInt32LE(40, 14);             // DIB header size
  buffer.writeInt32LE(width, 18);           // Width
  buffer.writeInt32LE(height, 22);          // Height (positive = bottom-up)
  buffer.writeUInt16LE(1, 26);              // Color planes
  buffer.writeUInt16LE(24, 28);             // Bits per pixel (24-bit)
  buffer.writeUInt32LE(0, 30);              // Compression (none)
  buffer.writeUInt32LE(pixelDataSize, 34);  // Image size
  buffer.writeInt32LE(2835, 38);            // X pixels per meter
  buffer.writeInt32LE(2835, 42);            // Y pixels per meter
  buffer.writeUInt32LE(0, 46);              // Colors in color table
  buffer.writeUInt32LE(0, 50);              // Important colors
  
  // Pixel data (bottom-up, BGR format)
  let offset = 54;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * info.channels;
      buffer[offset++] = data[srcIdx + 2]; // B
      buffer[offset++] = data[srcIdx + 1]; // G
      buffer[offset++] = data[srcIdx];     // R
    }
    // Padding
    const padding = rowSize - (width * 3);
    for (let p = 0; p < padding; p++) {
      buffer[offset++] = 0;
    }
  }
  
  fs.writeFileSync(bmpPath, buffer);
}

async function createIco(svgPath, icoPath) {
  // Create multiple sizes for ICO
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = [];
  
  for (const size of sizes) {
    const buffer = await sharp(svgPath)
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push({ size, buffer });
  }
  
  // Simple ICO file creation (single 256x256 PNG)
  // For a proper multi-resolution ICO, we'd need a specialized library
  // Using the 256x256 PNG as the main icon
  const png256 = await sharp(svgPath)
    .resize(256, 256)
    .png()
    .toBuffer();
  
  // ICO header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // Type (1 = ICO)
  header.writeUInt16LE(1, 4);      // Number of images
  
  // ICO directory entry
  const dirEntry = Buffer.alloc(16);
  dirEntry.writeUInt8(0, 0);       // Width (0 = 256)
  dirEntry.writeUInt8(0, 1);       // Height (0 = 256)
  dirEntry.writeUInt8(0, 2);       // Color palette
  dirEntry.writeUInt8(0, 3);       // Reserved
  dirEntry.writeUInt16LE(1, 4);    // Color planes
  dirEntry.writeUInt16LE(32, 6);   // Bits per pixel
  dirEntry.writeUInt32LE(png256.length, 8);  // Image size
  dirEntry.writeUInt32LE(22, 12);  // Offset to image data
  
  const icoBuffer = Buffer.concat([header, dirEntry, png256]);
  fs.writeFileSync(icoPath, icoBuffer);
}

async function createInstallerImages() {
  const assetsDir = __dirname;
  
  // Create wizard image (164x314 pixels for NSIS MUI2)
  console.log('Creating wizard image...');
  await sharp(path.join(assetsDir, 'wizard-image.svg'))
    .resize(164, 314)
    .png()
    .toFile(path.join(assetsDir, 'wizard.png'));
  
  await pngToBmp24(
    path.join(assetsDir, 'wizard.png'),
    path.join(assetsDir, 'wizard.bmp')
  );
  
  // Create header image (150x57 pixels for NSIS MUI2)
  console.log('Creating header image...');
  await sharp(path.join(assetsDir, 'header-image.svg'))
    .resize(150, 57)
    .png()
    .toFile(path.join(assetsDir, 'header.png'));
  
  await pngToBmp24(
    path.join(assetsDir, 'header.png'),
    path.join(assetsDir, 'header.bmp')
  );
  
  // Create ICO file
  console.log('Creating icon...');
  await createIco(
    path.join(assetsDir, 'icon.svg'),
    path.join(assetsDir, 'icon.ico')
  );
  
  console.log('Installer images created successfully!');
  console.log('- wizard.bmp (164x314)');
  console.log('- header.bmp (150x57)');
  console.log('- icon.ico (256x256)');
}

createInstallerImages().catch(console.error);
