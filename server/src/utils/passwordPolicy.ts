const COMMON_PASSWORDS = new Set([
  'password123!', 'password1234!', 'qwerty123456!', '123456789012!',
  'iloveyou123!', 'admin123456!', 'welcome12345!', 'tavriko12345!',
  'letmein12345!', 'abc123456789!'
]);

/**
 * Tavriko local-account password policy. This supplements (but does not
 * replace) breached-password screening from an external password corpus.
 */
export function validateStrongPassword(password: unknown): string | null {
  if (typeof password !== 'string') return 'Şifre metin biçiminde olmalıdır.';
  if (password.length < 12) return 'Şifre en az 12 karakter olmalıdır.';
  if (password.length > 128) return 'Şifre en fazla 128 karakter olabilir.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return 'Şifre en az bir küçük ve bir büyük harf içermelidir.';
  if (!/[0-9]/.test(password)) return 'Şifre en az bir rakam içermelidir.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Şifre en az bir özel karakter içermelidir.';
  const normalized = password.toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) return 'Bu şifre çok yaygın. Lütfen farklı bir şifre seçin.';
  if (/^(.)\1+$/.test(password) || /(012345|123456|234567|345678|456789|abcdef|qwerty)/i.test(password)) {
    return 'Kolay tahmin edilebilen ardışık veya tekrarlı karakterler kullanılamaz.';
  }
  return null;
}
