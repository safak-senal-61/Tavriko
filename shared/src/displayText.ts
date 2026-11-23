// Legacy notification and account text can contain emoji. Preserve ordinary
// punctuation, numbers, and user text outside the emoji sequence.
const pictograms = /(?:[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}\uFE0F|\p{Emoji_Presentation}|[\u200D\uFE0F])/gu;
export function plainDisplayText(text: string) {
  return text.replace(pictograms, '').replace(/[ \t]{2,}/g, ' ').trim();
}
