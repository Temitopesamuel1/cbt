/**
 * Client-side image compression and resizing utility.
 * Optimizes photos uploaded from mobile phones (cameras/galleries) or desktop computers
 * into clean, lightweight Base64 data URLs (~20KB - 50KB) suitable for Firestore storage.
 */
export function compressImageFile(
  file: File,
  maxWidth = 320,
  maxHeight = 320,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Basic file validation
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };

      img.onerror = () => {
        reject(new Error('Failed to parse image file.'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read image file.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compresses and resizes institutional logo images while preserving PNG/WebP transparency
 * whenever possible, keeping the resulting Data URL safely within Firestore's 500KB rule cap.
 */
export function compressLogoFile(
  file: File,
  maxDim = 300,
  maxChars = 220000
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file must be an image (PNG, JPG, WebP, or SVG).'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = typeof e.target?.result === 'string' ? e.target.result : '';
      if (!rawDataUrl) {
        reject(new Error('Unable to read logo image data.'));
        return;
      }

      // Small SVG logos can be stored directly if under size budget
      if (file.type === 'image/svg+xml' && rawDataUrl.length <= maxChars) {
        resolve(rawDataUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        let width = img.width || maxDim;
        let height = img.height || maxDim;

        if (width > height) {
          if (width > maxDim) {
            height = Math.max(1, Math.round((height * maxDim) / width));
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.max(1, Math.round((width * maxDim) / height));
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (rawDataUrl.length <= maxChars) resolve(rawDataUrl);
          else reject(new Error('Image processing is not supported in this browser.'));
          return;
        }

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const preserveTransparency =
          file.type === 'image/png' ||
          file.type === 'image/webp' ||
          file.type === 'image/svg+xml' ||
          file.type === 'image/gif';

        if (preserveTransparency) {
          const pngUrl = canvas.toDataURL('image/png');
          if (pngUrl.length <= maxChars) {
            resolve(pngUrl);
            return;
          }
          const webpUrl = canvas.toDataURL('image/webp', 0.85);
          if (webpUrl.length <= maxChars && webpUrl.startsWith('data:image/webp')) {
            resolve(webpUrl);
            return;
          }
        }

        // Fallback to white background + JPEG for ultra-dense images
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        let quality = 0.86;
        let jpegUrl = canvas.toDataURL('image/jpeg', quality);
        while (jpegUrl.length > maxChars && quality > 0.35) {
          quality -= 0.12;
          jpegUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(jpegUrl);
      };

      img.onerror = () => {
        reject(new Error('Failed to decode logo image file.'));
      };

      img.src = rawDataUrl;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read selected logo file.'));
    };

    reader.readAsDataURL(file);
  });
}

