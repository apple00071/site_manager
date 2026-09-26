import { formatDateTimeIST } from './dateUtils';

export interface WatermarkOptions {
  projectTitle?: string;
  projectAddress?: string;
  locationName?: string;
  coords?: { latitude: number; longitude: number };
  timestamp?: Date;
}

/**
 * Helper to truncate text to fit inside a maximum canvas width
 */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 4 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

/**
 * Stamps verified site location, GPS coordinates, date/time, and project info
 * directly onto a photo canvas before upload.
 * Automatically extracts embedded EXIF GPS/timestamp from gallery photos if present,
 * with fallbacks to current device location and project site address.
 */
export async function watermarkPhotoWithLocation(
  file: File,
  options: WatermarkOptions = {}
): Promise<File> {
  // Only process standard image types
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return file;
  }

  // 1. Check if the photo itself has embedded EXIF GPS / timestamp (e.g. photo taken with phone camera and uploaded from gallery)
  let photoCoords: { latitude: number; longitude: number } | undefined = options.coords;
  let photoLocationName: string | undefined = options.locationName;
  let photoTimestamp: Date | undefined = options.timestamp;

  try {
    const { extractExifData } = await import('./exifUtils');
    const exif = await extractExifData(file);
    if (exif?.coords) {
      photoCoords = exif.coords;
      try {
        const { reverseGeocode } = await import('./locationUtils');
        const resolvedAddress = await reverseGeocode(exif.coords.latitude, exif.coords.longitude);
        if (resolvedAddress) photoLocationName = resolvedAddress;
      } catch {
        // Fallback to coordinates
      }
    }
    if (exif?.timestamp) {
      photoTimestamp = exif.timestamp;
    }
  } catch (exifErr) {
    console.warn('Could not extract EXIF from photo:', exifErr);
  }

  // 2. Reliable location fallback hierarchy:
  // If photoLocationName looks like raw coordinates "17.3830, 78.4669", prefer projectTitle / projectAddress if available
  const isRawCoordsName = photoLocationName && /^-?\d+(\.\d+)?[,\s]+-?\d+(\.\d+)?$/.test(photoLocationName.trim());
  const effectiveLocation = (!isRawCoordsName && photoLocationName)
    || options.projectAddress
    || options.projectTitle
    || photoLocationName
    || 'Site Location';

  return new Promise((resolve) => {
    // Fail-safe timeout: if canvas processing takes > 5 seconds, return original file
    const safetyTimeout = setTimeout(() => {
      console.warn('Watermark timed out, uploading original photo');
      resolve(file);
    }, 5000);

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          clearTimeout(safetyTimeout);
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        // Limit maximum dimension to 1920 for fast upload and memory safety
        const maxDimension = 1920;
        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          clearTimeout(safetyTimeout);
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        // Draw original photo onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Calculate scaling factor based on the smaller dimension (min 1.0, max 2.6)
        // so portrait and landscape mobile photos have large, crystal-clear, readable stamps
        const minDim = Math.min(width, height);
        const scale = Math.max(1.0, Math.min(2.6, minDim / 800));

        // Format dates and text
        const dateTimeStr = formatDateTimeIST(photoTimestamp || options.timestamp || new Date());
        const projectStr = options.projectTitle ? options.projectTitle.trim() : '';

        // Determine lines of text to display
        const lines: { text: string; font: string; color: string }[] = [];

        // Line 1: Primary Location / Project (Bold & High Contrast)
        lines.push({
          text: `📍 ${effectiveLocation}`,
          font: `bold ${Math.round(20 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`,
          color: '#FFFFFF'
        });

        // Line 2: GPS Coordinates (Bold Vivid Gold, crisp sans-serif for crystal clarity)
        if (photoCoords) {
          const lat = photoCoords.latitude;
          const lon = photoCoords.longitude;
          const latStr = `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}`;
          const lonStr = `${Math.abs(lon).toFixed(6)}° ${lon >= 0 ? 'E' : 'W'}`;
          lines.push({
            text: `🌐 GPS: ${latStr}, ${lonStr}`,
            font: `bold ${Math.round(16 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`,
            color: '#FDE047' // Vivid bright yellow
          });
        } else if (options.projectAddress && effectiveLocation !== options.projectAddress) {
          lines.push({
            text: `🏢 Site: ${options.projectAddress}`,
            font: `bold ${Math.round(16 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`,
            color: '#FDE047'
          });
        } else if (projectStr && effectiveLocation !== projectStr) {
          lines.push({
            text: `🏢 Project: ${projectStr}`,
            font: `bold ${Math.round(16 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`,
            color: '#FDE047'
          });
        }

        // Line 3: Timestamp & Project info
        let metaLine = `🕒 ${dateTimeStr}`;
        if (projectStr && effectiveLocation !== projectStr) {
          metaLine += `  •  🏗️ ${projectStr}`;
        }
        lines.push({
          text: metaLine,
          font: `bold ${Math.round(15 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`,
          color: '#F1F5F9' // Crisp slate white
        });

        // Compute badge dimensions
        const padX = Math.round(20 * scale);
        const padY = Math.round(16 * scale);
        const accentWidth = Math.round(5 * scale);
        const textOffsetX = padX + accentWidth + Math.round(10 * scale);
        const lineHeight = Math.round(26 * scale);
        const badgeHeight = padY * 2 + lines.length * lineHeight;

        const margin = Math.round(24 * scale);
        const maxBadgeWidth = Math.min(width - margin * 2, Math.round(width * 0.94));

        // Measure text widths to make the badge neatly shrink-wrap or cap at maxBadgeWidth
        let maxTextW = 0;
        lines.forEach((l) => {
          ctx.font = l.font;
          const w = ctx.measureText(l.text).width;
          if (w > maxTextW) maxTextW = w;
        });

        const badgeWidth = Math.min(maxBadgeWidth, maxTextW + textOffsetX + padX);
        const badgeX = margin;
        const badgeY = height - badgeHeight - margin;
        const radius = Math.round(12 * scale);

        // Draw solid dark card background with vibrant amber border
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.lineWidth = Math.max(1.5, Math.round(2 * scale));

        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, radius);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
          ctx.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight);
        }

        // Draw amber vertical accent bar on the left inside edge
        ctx.fillStyle = '#F59E0B';
        const accentHeight = badgeHeight - padY * 2;
        ctx.fillRect(badgeX + padX, badgeY + padY, accentWidth, accentHeight);

        // Render text crisp with zero blur (dark background provides maximum contrast)
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        const maxAvailableTextWidth = badgeWidth - textOffsetX - padX;

        lines.forEach((l, idx) => {
          ctx.font = l.font;
          ctx.fillStyle = l.color;
          const textY = badgeY + padY + (idx + 0.75) * lineHeight;
          const trimmed = fitText(ctx, l.text, maxAvailableTextWidth);
          ctx.fillText(trimmed, badgeX + textOffsetX, textY);
        });

        ctx.restore();

        // Convert canvas back to File with high 94% JPEG quality for sharp text
        canvas.toBlob(
          (blob) => {
            clearTimeout(safetyTimeout);
            URL.revokeObjectURL(objectUrl);
            if (blob) {
              const fileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
              const watermarkedFile = new File([blob], fileName, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(watermarkedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.94
        );
      } catch (err) {
        clearTimeout(safetyTimeout);
        URL.revokeObjectURL(objectUrl);
        console.warn('Error watermarking image:', err);
        resolve(file);
      }
    };

    img.onerror = () => {
      clearTimeout(safetyTimeout);
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}
