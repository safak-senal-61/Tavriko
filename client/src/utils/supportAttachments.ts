import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
export const ATTACHMENT_MIMES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf', 'text/plain', 'application/zip',
];

export type PickedAttachment = { id: string; name: string; mime: string; size: number; base64: string };
export type RemoteAttachment = { id: string; name: string; mime: string; size: number };

const moduleOf = (name: string) => {
  try { return require(name); } catch { return null; }
};

const extensions: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf', txt: 'text/plain', zip: 'application/zip',
};

export const formatBytes = (size: number) =>
  size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;

function normalizeMime(mime: string | null | undefined, name: string): string | null {
  const value = (mime ?? '').toLowerCase().split(';')[0].trim();
  if (ATTACHMENT_MIMES.includes(value)) return value;
  const extension = name.toLowerCase().split('.').pop() ?? '';
  return extensions[extension] ?? null;
}

function base64Size(base64: string) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

async function readBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web' || uri.startsWith('data:')) {
    const blob = await (await fetch(uri)).blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Dosya okunamadı.'));
      reader.onload = () => resolve(String(reader.result ?? '').split(',')[1] ?? '');
      reader.readAsDataURL(blob);
    });
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

function prepare(name: string, mime: string | null | undefined, base64: string): { attachment?: PickedAttachment; error?: string } {
  if (!base64) return { error: 'Dosya okunamadı, başka bir dosya deneyin.' };
  const safeName = name.replace(/[\\/]+/g, '-').slice(0, 120) || `ek-${Date.now()}`;
  const type = normalizeMime(mime, safeName);
  if (!type) return { error: 'Bu dosya türü desteklenmiyor. Görsel, PDF, metin veya ZIP ekleyin.' };
  const size = base64Size(base64);
  if (!size) return { error: 'Dosya boş görünüyor.' };
  if (size > MAX_ATTACHMENT_BYTES) return { error: `Dosya çok büyük (${formatBytes(size)}). En fazla 3 MB ekleyebilirsiniz.` };
  return { attachment: { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: safeName, mime: type, size, base64 } };
}

export async function pickImageAttachment(): Promise<{ attachment?: PickedAttachment; error?: string }> {
  const picker = moduleOf('expo-image-picker');
  if (!picker?.launchImageLibraryAsync) return { error: 'Galeri bu sürümde kullanılamıyor.' };
  try {
    const result = await picker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true, allowsMultipleSelection: false });
    if (result.canceled || !result.assets?.length) return {};
    const asset = result.assets[0];
    const name = typeof asset.fileName === 'string' && asset.fileName ? asset.fileName : `ekran-goruntusu-${Date.now()}.jpg`;
    const base64 = asset.base64 || await readBase64(asset.uri);
    return prepare(name, asset.mimeType ?? null, base64);
  } catch {
    return { error: 'Galeriye erişilemedi. Dosya ekle seçeneğini deneyin.' };
  }
}

export async function pickFileAttachment(): Promise<{ attachment?: PickedAttachment; error?: string }> {
  const picker = moduleOf('expo-document-picker');
  if (!picker?.getDocumentAsync) return { error: 'Dosya seçici bu sürümde kullanılamıyor.' };
  try {
    const result = await picker.getDocumentAsync({ type: ATTACHMENT_MIMES, copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets?.length) return {};
    const asset = result.assets[0];
    const base64 = await readBase64(asset.uri);
    return prepare(asset.name || asset.uri.split('/').pop() || `ek-${Date.now()}`, asset.mimeType ?? null, base64);
  } catch {
    return { error: 'Dosya okunamadı, başka bir dosya deneyin.' };
  }
}

/** Fetches the attachment with the player token and returns an inline image or shares/downloads the file. */
export async function openRemoteAttachment(input: {
  api: string; token: string; caseId: string; attachment: RemoteAttachment;
}): Promise<{ imageUri?: string; error?: string }> {
  const base = input.api.replace(/\/+$/, '');
  const url = `${base}/support/${encodeURIComponent(input.caseId)}/attachments/${encodeURIComponent(input.attachment.id)}`;
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${input.token}` } });
    if (!response.ok) return { error: 'Ek dosya açılamadı.' };
    const blob = await response.blob();
    if (input.attachment.mime.startsWith('image/')) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read failed'));
        reader.onload = () => resolve(String(reader.result ?? '').split(',')[1] ?? '');
        reader.readAsDataURL(blob);
      });
      return base64 ? { imageUri: `data:${input.attachment.mime};base64,${base64}` } : { error: 'Ek dosya açılamadı.' };
    }
    const name = input.attachment.name.replace(/[\\/:*?"<>|]+/g, '-');
    if (Platform.OS === 'web') {
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href; link.download = name;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      return {};
    }
    const sharing = moduleOf('expo-sharing');
    if (!FileSystem.cacheDirectory || !sharing?.shareAsync) return { error: 'Dosya bu cihazda açılamıyor.' };
    const path = `${FileSystem.cacheDirectory}${name}`;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read failed'));
      reader.onload = () => resolve(String(reader.result ?? '').split(',')[1] ?? '');
      reader.readAsDataURL(blob);
    });
    await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
    await sharing.shareAsync(path, { mimeType: input.attachment.mime, dialogTitle: input.attachment.name });
    return {};
  } catch {
    return { error: 'Ek dosya açılamadı.' };
  }
}
