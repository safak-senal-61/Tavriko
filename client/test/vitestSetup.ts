/**
 * Vitest kurulum dosyası.
 *
 * Node test ortamında native modüller yüklenebilir olmalıdır; aksi halde
 * authStorage -> expo-secure-store içe aktarım zinciri testleri düşürür.
 */
import { vi } from 'vitest';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));

// React Native temel modülü de düz nesne olarak yeterli
vi.mock('react-native', () => ({
  Platform: { OS: 'web', select: (o: Record<string, unknown>) => o.web },
}));
