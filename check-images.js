// Simple dev-time checker to verify that all referenced product images exist on disk.
// Run with: node check-images.js

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const ASSETS_DIR = path.join(ROOT_DIR, 'assets', 'Dog product images');

/**
 * Collect all image paths referenced in data/products.json and js/app.js.
 * @returns {string[]} List of relative image paths.
 */
function collectReferencedImages() {
    const references = new Set();

    // From data/products.json
    try {
        const productsJsonPath = path.join(ROOT_DIR, 'data', 'products.json');
        const jsonRaw = fs.readFileSync(productsJsonPath, 'utf-8');
        const jsonData = JSON.parse(jsonRaw);
        if (jsonData && Array.isArray(jsonData.products)) {
            jsonData.products.forEach((product) => {
                if (product && typeof product.image === 'string') {
                    references.add(product.image);
                }
            });
        }
    } catch (error) {
        console.error('[check-images] Failed to read data/products.json:', error.message);
    }

    // From js/app.js (fallback fixed products)
    try {
        const appJsPath = path.join(ROOT_DIR, 'js', 'app.js');
        const appSource = fs.readFileSync(appJsPath, 'utf-8');
        const imagePathRegex = /["'`](assets\/[^"'`]+?\.(?:png|jpg|jpeg|gif|svg))["'`]/gi;
        let match;
        while ((match = imagePathRegex.exec(appSource)) !== null) {
            references.add(match[1]);
        }
    } catch (error) {
        console.error('[check-images] Failed to read js/app.js:', error.message);
    }

    return Array.from(references);
}

/**
 * Build a structured report for image existence checks.
 * @param {string[]} referencedImages List of relative image paths.
 * @param {(absolutePath: string) => boolean} fileExistsFn Function to determine whether a path exists.
 * @returns {{ totalReferenced: number, missingCount: number, foundCount: number, missingImages: { relativePath: string, absolutePath: string }[] }}
 */
function buildImageCheckReport(referencedImages, fileExistsFn) {
    if (!Array.isArray(referencedImages)) {
        throw new Error('[check-images] referencedImages must be an array of paths');
    }
    if (typeof fileExistsFn !== 'function') {
        throw new Error('[check-images] fileExistsFn must be a function');
    }

    const missingImages = [];
    let foundCount = 0;

    referencedImages.forEach((relativePath) => {
        const absolutePath = path.join(ROOT_DIR, relativePath.replace(/\//g, path.sep));
        const doesExist = fileExistsFn(absolutePath);

        if (!doesExist) {
            missingImages.push({
                relativePath,
                absolutePath
            });
        } else {
            foundCount += 1;
        }
    });

    return {
        totalReferenced: referencedImages.length,
        missingCount: missingImages.length,
        foundCount,
        missingImages
    };
}

/**
 * Check that each referenced image path exists on disk and log a human-readable summary.
 */
function checkImages() {
    const referencedImages = collectReferencedImages();
    if (referencedImages.length === 0) {
        console.log('[check-images] No image references found.');
        return;
    }

    console.log(`[check-images] Checking ${referencedImages.length} referenced image(s)...`);

    const report = buildImageCheckReport(referencedImages, (absolutePath) => fs.existsSync(absolutePath));

    report.missingImages.forEach((missingImage) => {
        console.log(`❌ Missing image: ${missingImage.relativePath} -> ${missingImage.absolutePath}`);
    });

    const foundImages = report.foundCount;
    if (foundImages > 0) {
        console.log(`[check-images] ${foundImages} image(s) were found on disk.`);
    }

    if (report.missingCount === 0) {
        console.log('[check-images] All referenced images were found.');
    } else {
        console.log(`[check-images] ${report.missingCount} image(s) are missing. Fix paths or files before production.`);
    }
}

if (require.main === module) {
    checkImages();
}

module.exports = {
    collectReferencedImages,
    buildImageCheckReport,
    checkImages
};

