import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Suba un archivo físico (imagen, PDF, etc.) a un bucket de Supabase Storage
 * y retorna la URL pública generada para ser almacenada en la base de datos.
 *
 * @param file Archivo a subir.
 * @param bucketName Nombre del bucket en Supabase Storage (por defecto: 'evidencias').
 * @returns Promise<string> URL pública accesible de la evidencia subida o string vacío en caso de error.
 */
export async function uploadEvidenciaToSupabase(
  file: File,
  bucketName = 'evidencias'
): Promise<string> {
  if (!file) return '';

  if (isSupabaseConfigured()) {
    try {
      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file);

      if (error) {
        console.warn(`Error al subir evidencia a Supabase Storage (${bucketName}):`, error);
        return '';
      }

      const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      const publicUrl = data?.publicUrl || '';
      console.log('Evidencia subida a Supabase Storage exitosamente:', publicUrl);
      return publicUrl;
    } catch (err) {
      console.warn('Excepción al subir evidencia a Supabase Storage:', err);
      return '';
    }
  }

  return '';
}

export const uploadFileToSupabase = uploadEvidenciaToSupabase;
export default uploadEvidenciaToSupabase;
