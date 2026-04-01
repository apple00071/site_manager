import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICON_SOURCE = path.join(__dirname, '../public/sidebar-logo.png');
const ANDROID_RES_DIR = path.join(__dirname, '../android/app/src/main/res');

const densities = {
    'mdpi': { small: 24, large: 48 },
    'hdpi': { small: 36, large: 72 },
    'xhdpi': { small: 48, large: 96 },
    'xxhdpi': { small: 72, large: 144 },
    'xxxhdpi': { small: 96, large: 192 }
};

async function generateAndroidIcons() {
    if (!fs.existsSync(ICON_SOURCE)) {
        console.error('Source icon not found:', ICON_SOURCE);
        process.exit(1);
    }

    console.log(`Generating Android notification icons from ${ICON_SOURCE}...`);

    for (const [density, sizes] of Object.entries(densities)) {
        const drawableDir = path.join(ANDROID_RES_DIR, `drawable-${density}`);
        
        if (!fs.existsSync(drawableDir)) {
            fs.mkdirSync(drawableDir, { recursive: true });
        }

        // 1. Small Icon (Status Bar) - MUST BE WHITE/ALPHA ONLY
        const smallIconPath = path.join(drawableDir, 'ic_stat_onesignal_default.png');
        await sharp(ICON_SOURCE)
            .resize(sizes.small, sizes.small)
            .raw()
            .toBuffer({ resolveWithObject: true })
            .then(({ data, info }) => {
                // Manually make it white + alpha
                for (let i = 0; i < data.length; i += info.channels) {
                    // Set RGB to 255 (White), keep Alpha
                    data[i] = 255;     // R
                    data[i + 1] = 255; // G
                    data[i + 2] = 255; // B
                }
                return sharp(data, { raw: info }).png().toFile(smallIconPath);
            });
        
        // 2. Large Icon (Notification Drawer) - FULL COLOR
        const largeIconPath = path.join(drawableDir, 'ic_onesignal_large_icon_default.png');
        await sharp(ICON_SOURCE)
            .resize(sizes.large, sizes.large)
            .toFile(largeIconPath);

        console.log(`✓ Generated icons for ${density}`);
    }

    console.log('\nAndroid icon generation complete!');
}

generateAndroidIcons().catch(err => {
    console.error('Failed to generate Android icons:', err);
    process.exit(1);
});
