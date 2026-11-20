export const FRIEND_CODE_PREFIX = 'TV-';

/** Accept a suffix or a copied full code without duplicating the fixed prefix. */
export function normalizeFriendCodeSuffix(input: string): string {
  const text = input.trim();
  const suffix = text.slice(0, FRIEND_CODE_PREFIX.length).toUpperCase() === FRIEND_CODE_PREFIX
    ? text.slice(FRIEND_CODE_PREFIX.length)
    : text;
  return suffix.replace(/[^a-z0-9]/gi, '').toUpperCase();
}
