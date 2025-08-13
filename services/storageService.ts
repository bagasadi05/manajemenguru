import { supabase } from './supabase';

export const uploadStudentAsset = async (userId: string, studentId: string, file: File) => {
    const filePath = `${userId}/${studentId}-${Date.now()}-${file.name}`;
    const uploadResult = await supabase.storage.from('teacher_assets').upload(filePath, file);
    if (uploadResult.error) {
        return { upload: uploadResult, url: null };
    }
    const { data: { publicUrl } } = supabase.storage.from('teacher_assets').getPublicUrl(filePath);
    return { upload: uploadResult, url: publicUrl };
};
