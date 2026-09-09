import { supabase } from './supabase';

/**
 * Compresses an image file using the browser's Canvas API.
 * Resizes to a max width/height while maintaining aspect ratio.
 */
export async function compressImage(file: File, maxDimension: number = 1200): Promise<File> {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.src = objectUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions
            if (width > height) {
                if (width > maxDimension) {
                    height *= maxDimension / width;
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width *= maxDimension / height;
                    height = maxDimension;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    URL.revokeObjectURL(objectUrl);
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    } else {
                        reject(new Error('Canvas toBlob failed'));
                    }
                },
                'image/jpeg',
                0.8 // 80% quality
            );
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(err);
        };
    });
}

function resolveContentType(file: File): string {
    if (file.type && file.type !== 'application/octet-stream') {
        return file.type;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'pdf': return 'application/pdf';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'png': return 'image/png';
        case 'webp': return 'image/webp';
        case 'gif': return 'image/gif';
        case 'dwg': return 'application/dwg';
        case 'dxf': return 'application/dxf';
        default: return file.type || 'application/octet-stream';
    }
}

function uploadToSignedUrl(
    signedUrl: string,
    file: File | Blob,
    contentType: string,
    onProgress?: (percent: number) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', contentType);

        if (onProgress && xhr.upload) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    onProgress(percent);
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
            } else {
                reject(new Error(`Storage upload failed with status ${xhr.status}: ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => reject(new Error('Network error during storage upload'));
        xhr.onabort = () => reject(new Error('Upload was aborted'));
        xhr.send(file);
    });
}

/**
 * Uploads a single file to Supabase storage.
 * Automatically compresses images before upload.
 * Uses pre-signed URLs directly to Supabase storage to bypass 4.5MB server limits and RLS issues.
 */
export async function uploadFile(
    file: File,
    bucket: string,
    folder: string,
    onProgress?: (percent: number) => void
): Promise<string> {
    let fileToUpload = file;

    // Handle HEIC format from Android/iOS devices
    if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif') {
        try {
            const heic2any = (await import('heic2any')).default;
            const convertedBlob = await heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.8
            });
            
            const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            
            fileToUpload = new File([blob], file.name.replace(/\.hei[cf]$/i, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
            });
        } catch (err) {
            console.error('HEIC conversion failed:', err);
            throw new Error('Failed to process HEIC image format.');
        }
    }

    // Only compress images
    if (fileToUpload.type.startsWith('image/')) {
        try {
            fileToUpload = await compressImage(fileToUpload);
        } catch (err) {
            console.warn('Compression failed, uploading original:', err);
        }
    }

    // 1. Primary path: Pre-signed upload URL directly to Supabase storage.
    // Completely bypasses Next.js / Vercel 4.5MB payload limits (prevents HTTP 413) and bypasses RLS issues.
    try {
        const signRes = await fetch('/api/upload/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bucket,
                folder,
                filename: fileToUpload.name,
            }),
        });

        if (signRes.ok) {
            const { signedUrl, publicUrl } = await signRes.json();
            if (signedUrl && publicUrl) {
                const contentType = resolveContentType(fileToUpload);
                await uploadToSignedUrl(signedUrl, fileToUpload, contentType, onProgress);
                return publicUrl;
            }
        } else {
            console.warn('Failed to get signed upload URL:', signRes.status);
        }
    } catch (signErr) {
        console.warn('Signed URL upload failed, attempting fallback:', signErr);
    }

    // 2. Fallback for smaller files (< 4MB) via server route
    const allowedApiBuckets = ['project-update-photos', 'inventory-bills', 'design-files', 'project-update-voices'];
    if (allowedApiBuckets.includes(bucket) && fileToUpload.size < 4 * 1024 * 1024) {
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('bucket', bucket);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            const data = await response.json();
            return data.url;
        }
    }

    // 3. Fallback to client-side direct upload
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, fileToUpload);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

    return publicUrl;
}

/**
 * Uploads multiple files concurrently with a progress callback.
 */
export async function uploadFiles(
    files: FileList | File[],
    bucket: string,
    folder: string,
    onProgress?: (uploadedCount: number, total: number) => void
): Promise<string[]> {
    const fileArray = Array.from(files);
    const total = fileArray.length;
    let uploadedCount = 0;

    const uploadPromises = fileArray.map(async (file) => {
        try {
            const url = await uploadFile(file, bucket, folder);
            uploadedCount++;
            onProgress?.(uploadedCount, total);
            return url;
        } catch (err) {
            console.error(`Failed to upload ${file.name}:`, err);
            return null;
        }
    });

    const results = await Promise.all(uploadPromises);
    return results.filter((url): url is string => url !== null);
}
