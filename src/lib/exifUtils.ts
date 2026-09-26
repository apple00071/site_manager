/**
 * Lightweight, zero-dependency JPEG EXIF parser to extract GPS coordinates and capture timestamp
 * directly from binary image headers (reads first 128KB).
 */

export interface ExifData {
  coords?: { latitude: number; longitude: number };
  timestamp?: Date;
}

export async function extractExifData(file: Blob): Promise<ExifData | null> {
  try {
    // Only JPEGs store standard APP1 Exif segments
    const slice = file.slice(0, 131072);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);

    if (view.byteLength < 16) return null;
    // Check JPEG SOI (0xFFD8)
    if (view.getUint16(0) !== 0xFFD8) return null;

    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      offset += 2;

      if (marker === 0xFFE1) {
        // APP1 Marker
        const segLength = view.getUint16(offset);
        // Check for 'Exif\0\0' (0x45, 0x78, 0x69, 0x66, 0x00, 0x00)
        if (
          view.getUint8(offset + 2) === 0x45 &&
          view.getUint8(offset + 3) === 0x78 &&
          view.getUint8(offset + 4) === 0x69 &&
          view.getUint8(offset + 5) === 0x66 &&
          view.getUint8(offset + 6) === 0x00 &&
          view.getUint8(offset + 7) === 0x00
        ) {
          return parseTiff(view, offset + 8);
        }
        offset += segLength;
      } else if ((marker & 0xFF00) === 0xFF00) {
        if (marker === 0xFFDA || marker === 0xFFD9) break; // SOS or EOI
        const segLength = view.getUint16(offset);
        offset += segLength;
      } else {
        break;
      }
    }
    return null;
  } catch (err) {
    console.warn('Failed to parse EXIF metadata:', err);
    return null;
  }
}

function parseTiff(view: DataView, tiffStart: number): ExifData | null {
  if (tiffStart + 8 > view.byteLength) return null;

  const endianTag = view.getUint16(tiffStart);
  const le = endianTag === 0x4949; // 'II' (Little-Endian)
  if (!le && endianTag !== 0x4D4D) return null; // 'MM' (Big-Endian)
  if (view.getUint16(tiffStart + 2, le) !== 0x002A) return null; // 42

  const ifd0Offset = view.getUint32(tiffStart + 4, le);
  let curOffset = tiffStart + ifd0Offset;
  if (curOffset + 2 > view.byteLength) return null;

  const numEntries = view.getUint16(curOffset, le);
  curOffset += 2;

  let exifOffset = 0;
  let gpsOffset = 0;

  for (let i = 0; i < numEntries; i++) {
    if (curOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(curOffset, le);
    if (tag === 0x8769) {
      exifOffset = view.getUint32(curOffset + 8, le);
    } else if (tag === 0x8825) {
      gpsOffset = view.getUint32(curOffset + 8, le);
    }
    curOffset += 12;
  }

  let coords: { latitude: number; longitude: number } | undefined = undefined;
  let timestamp: Date | undefined = undefined;

  // 1. Read GPS SubIFD
  if (gpsOffset > 0 && tiffStart + gpsOffset + 2 <= view.byteLength) {
    const gpsCur = tiffStart + gpsOffset;
    const gpsEntries = view.getUint16(gpsCur, le);
    let entryOffset = gpsCur + 2;

    let latRef = 'N';
    let lonRef = 'E';
    let latValues: number[] | null = null;
    let lonValues: number[] | null = null;

    for (let i = 0; i < gpsEntries; i++) {
      if (entryOffset + 12 > view.byteLength) break;
      const tag = view.getUint16(entryOffset, le);
      const valOffset = view.getUint32(entryOffset + 8, le);

      if (tag === 0x0001) {
        latRef = String.fromCharCode(view.getUint8(entryOffset + 8));
      } else if (tag === 0x0002) {
        latValues = readRationals(view, tiffStart + valOffset, 3, le);
      } else if (tag === 0x0003) {
        lonRef = String.fromCharCode(view.getUint8(entryOffset + 8));
      } else if (tag === 0x0004) {
        lonValues = readRationals(view, tiffStart + valOffset, 3, le);
      }
      entryOffset += 12;
    }

    if (latValues && lonValues && latValues.length === 3 && lonValues.length === 3) {
      let lat = latValues[0] + latValues[1] / 60 + latValues[2] / 3600;
      let lon = lonValues[0] + lonValues[1] / 60 + lonValues[2] / 3600;
      if (latRef === 'S' || latRef === 's') lat = -lat;
      if (lonRef === 'W' || lonRef === 'w') lon = -lon;
      if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        coords = { latitude: lat, longitude: lon };
      }
    }
  }

  // 2. Read Exif SubIFD (Capture Timestamp)
  if (exifOffset > 0 && tiffStart + exifOffset + 2 <= view.byteLength) {
    const exifCur = tiffStart + exifOffset;
    const exifEntries = view.getUint16(exifCur, le);
    let entryOffset = exifCur + 2;

    for (let i = 0; i < exifEntries; i++) {
      if (entryOffset + 12 > view.byteLength) break;
      const tag = view.getUint16(entryOffset, le);
      if (tag === 0x9003 || tag === 0x9004) { // DateTimeOriginal or DateTimeDigitized
        const valOffset = view.getUint32(entryOffset + 8, le);
        const strOffset = tiffStart + valOffset;
        let dateStr = '';
        for (let j = 0; j < 19; j++) {
          if (strOffset + j < view.byteLength) {
            dateStr += String.fromCharCode(view.getUint8(strOffset + j));
          }
        }
        // Format "YYYY:MM:DD HH:MM:SS"
        const match = dateStr.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
        if (match) {
          const parsed = new Date(
            parseInt(match[1], 10),
            parseInt(match[2], 10) - 1,
            parseInt(match[3], 10),
            parseInt(match[4], 10),
            parseInt(match[5], 10),
            parseInt(match[6], 10)
          );
          if (!isNaN(parsed.getTime())) {
            timestamp = parsed;
          }
        }
        break;
      }
      entryOffset += 12;
    }
  }

  return { coords, timestamp };
}

function readRationals(view: DataView, offset: number, count: number, le: boolean): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const base = offset + i * 8;
    if (base + 8 > view.byteLength) return result;
    const num = view.getUint32(base, le);
    const den = view.getUint32(base + 4, le);
    result.push(den === 0 ? 0 : num / den);
  }
  return result;
}
