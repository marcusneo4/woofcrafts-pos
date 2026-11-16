/**
 * WoofCrafts POS - tiny Excel (.xlsx) writer.
 *
 * Kept in the repo on purpose: the export must work on stall Wi-Fi without
 * fetching a library from a CDN. Writes plain worksheets with a styled header
 * row, dates, times, money and wrapped text. No compression (files stay small).
 *
 * Usage:
 *   const blob = XlsxLite.build([{ name: 'Orders', columns: [{ header, width, type }], rows: [[...]], totals: [...] }]);
 *
 * Column types: 'text' (default), 'number', 'money', 'date' (Excel serial), 'time' (day fraction), 'wrap'.
 * A totals entry is null, a string label, or { sum: true } to total that column.
 */
(function (root) {
    'use strict';

    const STYLE = { text: 0, header: 1, date: 2, time: 3, money: 4, wrap: 5, totalLabel: 6, totalMoney: 7, number: 8, totalNumber: 9 };

    // XML 1.0 forbids most control characters; a stray one makes Excel refuse the file.
    function xmlEscape(value) {
        return String(value == null ? '' : value)
            .replace(/[^\x09\x0A\x0D\x20-퟿-�]/g, '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function columnLetter(index) {
        let n = index + 1;
        let letters = '';
        while (n > 0) {
            const rem = (n - 1) % 26;
            letters = String.fromCharCode(65 + rem) + letters;
            n = Math.floor((n - 1) / 26);
        }
        return letters;
    }

    function sheetName(name, used) {
        let clean = String(name || 'Sheet').replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet';
        let candidate = clean;
        let n = 2;
        while (used.has(candidate.toLowerCase())) candidate = clean.slice(0, 28) + ' ' + (n++);
        used.add(candidate.toLowerCase());
        return candidate;
    }

    function textCell(ref, value, style) {
        const text = xmlEscape(value);
        if (!text) return `<c r="${ref}" s="${style}"/>`;
        return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
    }

    function numberCell(ref, value, style) {
        const n = Number(value);
        if (value === '' || value == null || !Number.isFinite(n)) return `<c r="${ref}" s="${style}"/>`;
        return `<c r="${ref}" s="${style}"><v>${n}</v></c>`;
    }

    function buildSheetXml(sheet) {
        const columns = sheet.columns || [];
        const rows = sheet.rows || [];
        const out = [];
        out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
        out.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">');
        out.push('<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>');
        out.push('<cols>' + columns.map((col, i) => `<col min="${i + 1}" max="${i + 1}" width="${Number(col.width) || 14}" customWidth="1"/>`).join('') + '</cols>');
        out.push('<sheetData>');
        out.push('<row r="1" ht="22" customHeight="1">' + columns.map((col, i) => textCell(columnLetter(i) + '1', col.header, STYLE.header)).join('') + '</row>');

        rows.forEach((row, r) => {
            const rowNumber = r + 2;
            const cells = columns.map((col, c) => {
                const ref = columnLetter(c) + rowNumber;
                const value = row[c];
                switch (col.type) {
                    case 'number': return numberCell(ref, value, STYLE.number);
                    case 'money': return numberCell(ref, value, STYLE.money);
                    case 'date': return numberCell(ref, value, STYLE.date);
                    case 'time': return numberCell(ref, value, STYLE.time);
                    case 'wrap': return textCell(ref, value, STYLE.wrap);
                    default: return textCell(ref, value, STYLE.text);
                }
            });
            out.push(`<row r="${rowNumber}">${cells.join('')}</row>`);
        });

        if (Array.isArray(sheet.totals) && rows.length > 0) {
            const totalRow = rows.length + 2;
            const cells = columns.map((col, c) => {
                const ref = columnLetter(c) + totalRow;
                const spec = sheet.totals[c];
                if (spec && typeof spec === 'object' && spec.sum) {
                    const letter = columnLetter(c);
                    // The cached value lets previewers that do not calculate still show the total.
                    const cached = rows.reduce((sum, row) => sum + (Number(row[c]) || 0), 0);
                    const style = col.type === 'money' ? STYLE.totalMoney : STYLE.totalNumber;
                    return `<c r="${ref}" s="${style}"><f>SUM(${letter}2:${letter}${totalRow - 1})</f><v>${Math.round(cached * 100) / 100}</v></c>`;
                }
                return textCell(ref, typeof spec === 'string' ? spec : '', STYLE.totalLabel);
            });
            out.push(`<row r="${totalRow}">${cells.join('')}</row>`);
        }

        out.push('</sheetData>');
        if (rows.length > 0 && columns.length > 0) {
            out.push(`<autoFilter ref="A1:${columnLetter(columns.length - 1)}${rows.length + 1}"/>`);
        }
        out.push('<pageSetup orientation="landscape"/>');
        out.push('</worksheet>');
        return out.join('');
    }

    const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + '<numFmts count="3">'
        + '<numFmt numFmtId="164" formatCode="d mmm yyyy"/>'
        + '<numFmt numFmtId="165" formatCode="hh:mm"/>'
        + '<numFmt numFmtId="166" formatCode="&quot;$&quot;#,##0.00"/>'
        + '</numFmts>'
        + '<fonts count="3">'
        + '<font><sz val="10"/><name val="Arial"/></font>'
        + '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>'
        + '<font><b/><sz val="10"/><name val="Arial"/></font>'
        + '</fonts>'
        + '<fills count="3">'
        + '<fill><patternFill patternType="none"/></fill>'
        + '<fill><patternFill patternType="gray125"/></fill>'
        + '<fill><patternFill patternType="solid"><fgColor rgb="FF3B2E22"/><bgColor indexed="64"/></patternFill></fill>'
        + '</fills>'
        + '<borders count="2">'
        + '<border><left/><right/><top/><bottom/><diagonal/></border>'
        + '<border><left/><right/><top style="medium"><color rgb="FF3B2E22"/></top><bottom/><diagonal/></border>'
        + '</borders>'
        + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        + '<cellXfs count="10">'
        + '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>'
        + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
        + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>'
        + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>'
        + '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>'
        + '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
        + '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>'
        + '<xf numFmtId="166" fontId="2" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>'
        + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>'
        + '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>'
        + '</cellXfs>'
        + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        + '</styleSheet>';

    // ---- ZIP container (stored, no compression)
    let crcTable = null;
    function crc32(bytes) {
        if (!crcTable) {
            crcTable = new Uint32Array(256);
            for (let n = 0; n < 256; n++) {
                let c = n;
                for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                crcTable[n] = c >>> 0;
            }
        }
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function zip(files) {
        const encoder = new TextEncoder();
        const parts = [];
        const central = [];
        let offset = 0;

        files.forEach((file) => {
            const nameBytes = encoder.encode(file.name);
            const data = encoder.encode(file.content);
            const crc = crc32(data);

            const local = new DataView(new ArrayBuffer(30));
            local.setUint32(0, 0x04034b50, true);
            local.setUint16(4, 20, true);        // version needed
            local.setUint16(6, 0x0800, true);    // UTF-8 names
            local.setUint16(8, 0, true);         // stored
            local.setUint16(10, 0, true);        // time
            local.setUint16(12, 0x21, true);     // date: 1 Jan 1980
            local.setUint32(14, crc, true);
            local.setUint32(18, data.length, true);
            local.setUint32(22, data.length, true);
            local.setUint16(26, nameBytes.length, true);
            local.setUint16(28, 0, true);
            parts.push(new Uint8Array(local.buffer), nameBytes, data);

            const entry = new DataView(new ArrayBuffer(46));
            entry.setUint32(0, 0x02014b50, true);
            entry.setUint16(4, 20, true);
            entry.setUint16(6, 20, true);
            entry.setUint16(8, 0x0800, true);
            entry.setUint16(10, 0, true);
            entry.setUint16(12, 0, true);
            entry.setUint16(14, 0x21, true);
            entry.setUint32(16, crc, true);
            entry.setUint32(20, data.length, true);
            entry.setUint32(24, data.length, true);
            entry.setUint16(28, nameBytes.length, true);
            entry.setUint32(42, offset, true);
            central.push(new Uint8Array(entry.buffer), nameBytes);

            offset += 30 + nameBytes.length + data.length;
        });

        const centralSize = central.reduce((sum, part) => sum + part.length, 0);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(8, files.length, true);
        end.setUint16(10, files.length, true);
        end.setUint32(12, centralSize, true);
        end.setUint32(16, offset, true);

        return [...parts, ...central, new Uint8Array(end.buffer)];
    }

    /** Build the workbook and return its parts as an array of Uint8Array. */
    function buildParts(sheets) {
        if (!Array.isArray(sheets) || sheets.length === 0) throw new Error('XlsxLite: at least one sheet is required');
        const used = new Set();
        const names = sheets.map((sheet) => sheetName(sheet.name, used));

        const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            + '<Default Extension="xml" ContentType="application/xml"/>'
            + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
            + '</Types>';

        const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            + '</Relationships>';

        const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            + '<sheets>' + names.map((name, i) => `<sheet name="${xmlEscape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets>'
            + '<calcPr fullCalcOnLoad="1"/>'
            + '</workbook>';

        const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
            + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
            + '</Relationships>';

        const files = [
            { name: '[Content_Types].xml', content: contentTypes },
            { name: '_rels/.rels', content: rootRels },
            { name: 'xl/workbook.xml', content: workbook },
            { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
            { name: 'xl/styles.xml', content: STYLES_XML }
        ].concat(sheets.map((sheet, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content: buildSheetXml(sheet) })));

        return zip(files);
    }

    function build(sheets) {
        return new Blob(buildParts(sheets), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    root.XlsxLite = { build, buildParts, columnLetter };
})(typeof window !== 'undefined' ? window : globalThis);
