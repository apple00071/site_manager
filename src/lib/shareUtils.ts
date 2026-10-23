import { Capacitor } from '@capacitor/core';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Extract the base64 data portion
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const downloadPhotos = async (urls: string[]): Promise<File[]> => {
  const files: File[] = [];
  // Limit to sharing max 10 photos to prevent system share sheet crash and high download time
  const limitedUrls = urls.slice(0, 10);
  
  for (let i = 0; i < limitedUrls.length; i++) {
    const url = limitedUrls[i];
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const blob = await response.blob();
      
      const mimeType = blob.type || 'image/jpeg';
      let extension = 'jpg';
      if (mimeType === 'image/png') extension = 'png';
      else if (mimeType === 'image/webp') extension = 'webp';
      else if (mimeType === 'application/pdf') extension = 'pdf';
      
      const file = new File([blob], `share_file_${i + 1}.${extension}`, { type: mimeType });
      files.push(file);
    } catch (err) {
      console.error('CORS or fetch error downloading file for sharing:', url, err);
    }
  }
  return files;
};

export const shareToWhatsAppUtil = async (
  text: string,
  urls: string[] = [],
  dialogTitle: string = 'Share via WhatsApp'
) => {
  const cleanDescription = text || '';
  const hasPhotos = urls && urls.length > 0;

  try {
    // 1. Try native Capacitor sharing first if running inside mobile app
    if (hasPhotos && Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        
        const nativeFileUris: string[] = [];
        const limitedUrls = urls.slice(0, 10);
        
        for (let i = 0; i < limitedUrls.length; i++) {
          const url = limitedUrls[i];
          try {
            // Parse extension from URL
            let extension = 'jpg';
            const cleanUrl = url.split('?')[0].toLowerCase();
            if (cleanUrl.endsWith('.png')) extension = 'png';
            else if (cleanUrl.endsWith('.webp')) extension = 'webp';
            else if (cleanUrl.endsWith('.pdf')) extension = 'pdf';
            
            const filename = `share_photo_${i + 1}_${Date.now()}.${extension}`;
            
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Failed to fetch file: ${response.statusText}`);
            }
            const blob = await response.blob();
            const base64Data = await blobToBase64(blob);
            
            await Filesystem.writeFile({
              path: filename,
              data: base64Data,
              directory: Directory.Cache
            });
            
            const uriResult = await Filesystem.getUri({
              directory: Directory.Cache,
              path: filename
            });
            
            if (uriResult?.uri) {
              nativeFileUris.push(uriResult.uri);
            }
          } catch (err: any) {
            console.error('Error downloading image natively for share:', url, err);
            alert('File download error: ' + (err?.message || JSON.stringify(err)));
          }
        }
        
        if (nativeFileUris.length > 0) {
          if (cleanDescription) {
            try { await navigator.clipboard.writeText(cleanDescription); } catch (e) {}
          }

          const shareOptions: any = {
            files: nativeFileUris,
            dialogTitle
          };

          if (nativeFileUris.length === 1 && cleanDescription) {
            shareOptions.text = cleanDescription;
          }
          
          await Share.share(shareOptions);
          return;
        }
      } catch (nativeErr: any) {
        console.error('Capacitor native share failed, trying Median/GoNative fallback:', nativeErr);
        alert('Capacitor share failed: ' + (nativeErr?.message || JSON.stringify(nativeErr)));
      }
    }

    // 1.5 Try Median/GoNative native file sharing if running inside Median/GoNative app
    // @ts-ignore
    const isMedianApp = typeof window !== 'undefined' && (window.median || window.gonative);
    if (hasPhotos && isMedianApp) {
      try {
        const medianShare = (window as any).median?.share || (window as any).gonative?.share;
        if (medianShare && typeof medianShare.downloadFile === 'function') {
          if (cleanDescription) {
            try { await navigator.clipboard.writeText(cleanDescription); } catch (e) {}
          }
          await medianShare.downloadFile({
            url: urls[0],
            open: true
          });
          return;
        }
      } catch (medianErr: any) {
        console.error('Median native downloadFile failed, falling back to Web Share API:', medianErr);
        alert('Median downloadFile failed: ' + (medianErr?.message || JSON.stringify(medianErr)));
      }
    }

    // 2. Try to use native Web Share API with files if supported (Browser/PWA)
    if (hasPhotos && navigator.share && navigator.canShare) {
      const filesToShare = await downloadPhotos(urls);
      
      if (filesToShare.length > 0) {
        if (cleanDescription) {
          try { await navigator.clipboard.writeText(cleanDescription); } catch (e) {}
        }

        const shareData: ShareData = {
          files: filesToShare,
        };
        
        if (filesToShare.length === 1 && cleanDescription) {
          shareData.text = cleanDescription;
        }
        
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }
    }
    
    // 3. Fallback to direct WhatsApp link redirect (e.g. desktop/unsupported browser)
    let fallbackMessage = '';
    if (cleanDescription) {
      fallbackMessage += `${cleanDescription}\n\n`;
    }
    
    if (hasPhotos) {
      urls.forEach((url) => {
        fallbackMessage += `${url}\n`;
      });
    }
    
    fallbackMessage = fallbackMessage.trim();
    
    if (fallbackMessage) {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fallbackMessage)}`;
      window.open(waUrl, '_blank');
    }
  } catch (shareError) {
    console.error('Error sharing content:', shareError);
    
    if (cleanDescription) {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(cleanDescription)}`;
      window.open(waUrl, '_blank');
    }
  }
};

/**
 * Universal text / note sharing function.
 * Works seamlessly on Android / iOS Capacitor native apps, Median webviews, and mobile/desktop browsers.
 */
export const shareTextOrNote = async ({
  title,
  text,
  dialogTitle = 'Share Note'
}: {
  title?: string;
  text: string;
  dialogTitle?: string;
}): Promise<{ success: boolean; method: string }> => {
  const cleanTitle = title ? title.trim() : '';
  const cleanText = text ? text.trim() : '';
  const fullMessage = cleanTitle ? `*${cleanTitle}*\n\n${cleanText}` : cleanText;

  // 1. Capacitor Native Platform (Android / iOS APK)
  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: cleanTitle || 'Note',
        text: fullMessage,
        dialogTitle
      });
      return { success: true, method: 'capacitor' };
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('canceled') || err?.message?.includes('cancelled')) {
        return { success: true, method: 'cancelled' };
      }
      console.warn('Capacitor native share failed, falling back:', err);
    }
  }

  // 2. Median / GoNative Android wrapper
  // @ts-ignore
  if (typeof window !== 'undefined' && ((window as any).median?.share || (window as any).gonative?.share)) {
    try {
      const medianShare = (window as any).median?.share || (window as any).gonative?.share;
      if (typeof medianShare?.shareText === 'function') {
        medianShare.shareText({ text: fullMessage });
        return { success: true, method: 'median' };
      }
    } catch (medianErr) {
      console.warn('Median shareText failed:', medianErr);
    }
  }

  // 3. Web Share API (Mobile Chrome / Safari)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: cleanTitle || 'Note',
        text: fullMessage
      });
      return { success: true, method: 'web-share' };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: true, method: 'cancelled' };
      }
      console.warn('Web Share API failed, falling back:', err);
    }
  }

  // 4. Clipboard fallback
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(fullMessage);
      return { success: true, method: 'clipboard' };
    } catch (e) {}
  }

  return { success: false, method: 'failed' };
};

/**
 * Universal WhatsApp direct share.
 * In Android / iOS native apps, triggers the native share dialog targeted for WhatsApp,
 * or opens the whatsapp:// protocol or web link.
 */
export const shareToWhatsAppDirect = async (text: string, title?: string) => {
  const cleanTitle = title ? title.trim() : '';
  const cleanText = text ? text.trim() : '';
  const fullMessage = cleanTitle ? `*${cleanTitle}*\n\n${cleanText}` : cleanText;
  const encoded = encodeURIComponent(fullMessage);

  // 1. Capacitor Native Platform (Android / iOS APK)
  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: cleanTitle || 'Note',
        text: fullMessage,
        dialogTitle: 'Share via WhatsApp'
      });
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('canceled') || err?.message?.includes('cancelled')) {
        return;
      }
    }
  }

  // 2. Direct WhatsApp intent / URL
  const waScheme = `whatsapp://send?text=${encoded}`;
  const waWeb = `https://api.whatsapp.com/send?text=${encoded}`;

  if (typeof window !== 'undefined') {
    try {
      // In mobile browser, whatsapp:// launches native WhatsApp app directly
      window.location.href = waScheme;
      setTimeout(() => {
        window.open(waWeb, '_blank');
      }, 700);
    } catch {
      window.open(waWeb, '_blank');
    }
  }
};

/**
 * Safely opens a quotation print URL across mobile app webviews and desktop browsers.
 * In Android/iOS apps or mobile browsers where window.open('_blank') is blocked,
 * it navigates in the current window. On desktop, it opens in a new tab.
 */
export const openQuotationPrint = (url: string) => {
  if (typeof window === 'undefined') return;
  const isMobile =
    Capacitor.isNativePlatform() ||
    // @ts-ignore
    Boolean((window as any).median || (window as any).gonative) ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.innerWidth < 768;

  if (isMobile) {
    window.location.href = url;
  } else {
    const win = window.open(url, '_blank');
    if (!win) {
      window.location.href = url;
    }
  }
};

/**
 * Universal PDF downloader and native share trigger.
 * Fixes the issue where blob downloads fail silently inside Android / iOS WebViews.
 */
export const shareOrDownloadPdfBlob = async (
  blob: Blob,
  filename: string,
  title: string = 'Quotation PDF'
): Promise<boolean> => {
  const safeFilename = filename.replace(/[^\w.-]/g, '_');

  // 1. Capacitor Native Platform (Android / iOS APK)
  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');

      const base64Data = await blobToBase64(blob);

      // Save to Cache so Android system share sheet / print can read it
      await Filesystem.writeFile({
        path: safeFilename,
        data: base64Data,
        directory: Directory.Cache
      });

      const uriResult = await Filesystem.getUri({
        directory: Directory.Cache,
        path: safeFilename
      });

      if (uriResult?.uri) {
        await Share.share({
          title,
          files: [uriResult.uri],
          dialogTitle: `Share or Print ${title}`
        });
        return true;
      }
    } catch (nativeErr: any) {
      if (nativeErr?.name === 'AbortError' || nativeErr?.message?.includes('canceled') || nativeErr?.message?.includes('cancelled')) {
        return true;
      }
      console.warn('Capacitor native PDF share failed, trying fallbacks:', nativeErr);
    }
  }

  // 2. Median / GoNative Android app wrapper
  // @ts-ignore
  if (typeof window !== 'undefined' && ((window as any).median?.share || (window as any).gonative?.share)) {
    try {
      const base64Data = await blobToBase64(blob);
      const median = (window as any).median || (window as any).gonative;
      if (median.share?.downloadFile) {
        const dataUri = `data:application/pdf;base64,${base64Data}`;
        await median.share.downloadFile({ url: dataUri, open: true });
        return true;
      }
    } catch (medianErr) {
      console.warn('Median downloadFile failed:', medianErr);
    }
  }

  // 3. Web Share API with File (Mobile Chrome / Safari on iOS / Android)
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], safeFilename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: `Here is your quotation: ${safeFilename}`
        });
        return true;
      }
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') return true;
      console.warn('Web Share failed, falling back to download:', shareErr);
    }
  }

  // 4. Standard Browser Blob Download
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    return true;
  } catch (err) {
    console.error('Browser download failed:', err);
    return false;
  }
};

