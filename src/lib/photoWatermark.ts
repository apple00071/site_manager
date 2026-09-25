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
 */
export async function watermarkPhotoWithLocation(
  file: File,
  options: WatermarkOptions = {}
): Promise<File> {
  // Only process standard image types
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return file;
  }

  return new Promise((resolve) => {
    // Fail-safe timeout: if canvas processing takes > 4 seconds, return original file
    const safetyTimeout = setTimeout(() => {
      console.warn('Watermark timed out, uploading original photo');
      resolve(file);
    }, 4000);

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

        // Calculate scaling factor based on canvas resolution (reference: 1100px base)
        const scale = Math.max(0.65, Math.min(2.4, width / 1100));

        // Format dates and text
        const dateTimeStr = formatDateTimeIST(options.timestamp || new Date());
        const projectStr = options.projectTitle ? options.projectTitle.trim() : '';

        // Determine lines of text to display
        const lines: { text: string; font: string; color: string }[] = [];

        // Line 1: Primary Location
        const locTitle = options.locationName || options.projectAddress || projectStr || 'Site Location';
        lines.push({
          text: `📍 ${locTitle}`,
          font: `bold ${Math.round(16 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
          color: '#FFFFFF'
        });

        // Line 2: GPS Coordinates (if available)
        if (options.coords) {
          const lat = options.coords.latitude;
          const lon = options.coords.longitude;
          const latStr = `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}`;
          const lonStr = `${Math.abs(lon).toFixed(6)}° ${lon >= 0 ? 'E' : 'W'}`;
          lines.push({
            text: `🌐 GPS: ${latStr}, ${lonStr}`,
            font: `${Math.round(12.5 * scale)}px "SF Mono", Consolas, "Courier New", monospace, sans-serif`,
            color: '#FDE68A' // Light amber
          });
        }

        // Line 3: Timestamp & Project
        let metaLine = `🕒 ${dateTimeStr}`;
        if (projectStr) {
          metaLine += `  •  🏗️ ${projectStr}`;
        }
        lines.push({
          text: metaLine,
          font: `${Math.round(12 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
          color: '#E2E8F0' // Light slate
        });

        // Compute badge dimensions
        const padX = Math.round(16 * scale);
        const padY = Math.round(12 * scale);
        const accentWidth = Math.round(4 * scale);
        const textOffsetX = padX + accentWidth + Math.round(8 * scale);
        const lineHeight = Math.round(21 * scale);
        const badgeHeight = padY * 2 + lines.length * lineHeight;

        const margin = Math.round(20 * scale);
        const maxBadgeWidth = Math.min(width - margin * 2, Math.round(width * 0.92));

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
        const radius = Math.round(10 * scale);

        // Draw translucent dark card background with amber border
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
        ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));

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

        // Draw text with subtle drop shadow for high contrast on any photo
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 3 * scale;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        const maxAvailableTextWidth = badgeWidth - textOffsetX - padX;

        lines.forEach((l, idx) => {
          ctx.font = l.font;
          ctx.fillStyle = l.color;
          const textY = badgeY + padY + (idx + 0.75) * lineHeight;
          const trimmed = fitText(ctx, l.text, maxAvailableTextWidth);
          ctx.fillText(trimmed, badgeX + textOffsetX, textY);
        });

        ctx.restore();

        // Convert canvas back to File
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
          0.88
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
