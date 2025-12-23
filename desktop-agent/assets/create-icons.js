// Script to create tray icon PNG
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation
function crc32(data) {
    let crc = 0xffffffff;
    const table = [];
    
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    
    for (let i = 0; i < data.length; i++) {
        crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    
    return (crc ^ 0xffffffff) >>> 0;
}

function createPNG(width, height, rgba) {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    
    // IHDR chunk
    const ihdr = Buffer.alloc(25);
    ihdr.writeUInt32BE(13, 0);
    ihdr.write('IHDR', 4);
    ihdr.writeUInt32BE(width, 8);
    ihdr.writeUInt32BE(height, 12);
    ihdr[16] = 8;
    ihdr[17] = 6;
    ihdr[18] = 0;
    ihdr[19] = 0;
    ihdr[20] = 0;
    
    const ihdrData = ihdr.slice(4, 21);
    const ihdrCrc = crc32(ihdrData);
    ihdr.writeUInt32BE(ihdrCrc, 21);
    
    // IDAT chunk
    const rawData = Buffer.alloc(height * (1 + width * 4));
    for (let y = 0; y < height; y++) {
        rawData[y * (1 + width * 4)] = 0;
        for (let x = 0; x < width; x++) {
            const srcIdx = (y * width + x) * 4;
            const dstIdx = y * (1 + width * 4) + 1 + x * 4;
            rawData[dstIdx] = rgba[srcIdx];
            rawData[dstIdx + 1] = rgba[srcIdx + 1];
            rawData[dstIdx + 2] = rgba[srcIdx + 2];
            rawData[dstIdx + 3] = rgba[srcIdx + 3];
        }
    }
    
    const compressed = zlib.deflateSync(rawData);
    
    const idat = Buffer.alloc(12 + compressed.length);
    idat.writeUInt32BE(compressed.length, 0);
    idat.write('IDAT', 4);
    compressed.copy(idat, 8);
    const idatData = Buffer.concat([Buffer.from('IDAT'), compressed]);
    const idatCrc = crc32(idatData);
    idat.writeUInt32BE(idatCrc, 8 + compressed.length);
    
    // IEND chunk
    const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    
    return Buffer.concat([signature, ihdr, idat, iend]);
}

// Create 16x16 purple circle icon for tray
const size = 16;
const rgba = Buffer.alloc(size * size * 4);

for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const centerX = size / 2;
        const centerY = size / 2;
        const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        
        if (dist < 6.5) {
            rgba[idx] = 99;
            rgba[idx + 1] = 102;
            rgba[idx + 2] = 241;
            rgba[idx + 3] = 255;
        } else if (dist < 7.5) {
            const alpha = Math.max(0, Math.min(255, (7.5 - dist) * 255));
            rgba[idx] = 99;
            rgba[idx + 1] = 102;
            rgba[idx + 2] = 241;
            rgba[idx + 3] = Math.floor(alpha);
        } else {
            rgba[idx] = 0;
            rgba[idx + 1] = 0;
            rgba[idx + 2] = 0;
            rgba[idx + 3] = 0;
        }
    }
}

const png = createPNG(size, size, rgba);
fs.writeFileSync(path.join(__dirname, 'tray-icon.png'), png);
console.log('Created tray-icon.png');

// Create 256x256 app icon
const appSize = 256;
const appRgba = Buffer.alloc(appSize * appSize * 4);

for (let y = 0; y < appSize; y++) {
    for (let x = 0; x < appSize; x++) {
        const idx = (y * appSize + x) * 4;
        const margin = 20;
        const inRect = x >= margin && x < appSize - margin && y >= margin && y < appSize - margin;
        
        if (inRect) {
            const t = (x + y) / (appSize * 2);
            appRgba[idx] = Math.floor(99 + t * 40);
            appRgba[idx + 1] = Math.floor(102 - t * 10);
            appRgba[idx + 2] = Math.floor(241 + t * 5);
            appRgba[idx + 3] = 255;
        } else {
            appRgba[idx] = 0;
            appRgba[idx + 1] = 0;
            appRgba[idx + 2] = 0;
            appRgba[idx + 3] = 0;
        }
    }
}

const appPng = createPNG(appSize, appSize, appRgba);
fs.writeFileSync(path.join(__dirname, 'icon.png'), appPng);
console.log('Created icon.png');
