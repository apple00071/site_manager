import { supabase } from './supabase';

/**
 * Compresses an image file using the browser's Canvas API.
 * Resizes to a max width/height while maintaining aspect ratio.
 */
export async function compressImage(file: File, maxDimension: number = 1200): Promise<File> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
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
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

/**
 * Uploads a single file to Supabase storage.
 * Automatically compresses images before upload.
 */
export async function uploadFile(
    file: File,
    bucket: string,
    folder: string
): Promise<string> {
    let fileToUpload = file;

    // Only compress images
    if (file.type.startsWith('image/')) {
        try {
            fileToUpload = await compressImage(file);
        } catch (err) {
            console.warn('Compression failed, uploading original:', err);
        }
    }

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
