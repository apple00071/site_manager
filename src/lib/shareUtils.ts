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
