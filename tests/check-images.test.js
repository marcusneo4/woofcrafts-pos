const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
    collectReferencedImages,
    buildImageCheckReport
} = require('../check-images');

test('collectReferencedImages returns an array of strings', () => {
    const result = collectReferencedImages();

    assert.ok(Array.isArray(result), 'Result should be an array');
    result.forEach((entry) => {
        assert.equal(typeof entry, 'string', 'Each entry should be a string path');
    });
});

test('buildImageCheckReport validates arguments defensively', () => {
    assert.throws(
        () => buildImageCheckReport(null, () => true),
        /referencedImages must be an array of paths/
    );

    assert.throws(
        () => buildImageCheckReport([], null),
        /fileExistsFn must be a function/
    );
});

test('buildImageCheckReport correctly identifies found and missing images', () => {
    const referencedImages = [
        'assets/Dog product images/Big Identification Tag.jpg',
        'assets/Dog product images/Missing Image.jpg'
    ];

    const existingAbsolute = path.join(
        __dirname,
        '..',
        'assets',
        'Dog product images',
        'Big Identification Tag.jpg'
    );

    const fakeExists = (absolutePath) => absolutePath === existingAbsolute;

    const report = buildImageCheckReport(referencedImages, fakeExists);

    assert.equal(report.totalReferenced, 2);
    assert.equal(report.foundCount, 1);
    assert.equal(report.missingCount, 1);
    assert.equal(report.missingImages.length, 1);
    assert.equal(
        report.missingImages[0].relativePath,
        'assets/Dog product images/Missing Image.jpg'
    );
});

