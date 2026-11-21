import "server-only";
import { randomInt } from "node:crypto";

// A account's public-ish label: what the admin panel and (later) a donor see instead of a phone
// number. Two plain Bangla words in Latin script plus three digits - short enough to read out over
// the phone, long enough that nobody lands on someone else's by accident.
//
// This is a LABEL, not a secret. The session cookie is what proves who you are, so the word lists
// are deliberately small and friendly rather than high-entropy. 48 x 48 x 9000 = ~20.7M (a million accounts still collide rarely; ensureAccount retries).

const FIRST = [
  "shanto", "sundor", "sahosi", "sotto", "sobuj", "surjo", "sagor", "shital",
  "alo", "akash", "ananda", "asha", "amar", "agun", "ayna", "abir",
  "nodi", "notun", "nouka", "nirob", "nayan", "neel", "nirmol", "niribili",
  "megh", "mithu", "modhu", "mukti", "moyna", "mishti", "morom", "mela",
  "brishti", "bhalo", "batas", "bijoy", "bondhu", "bagan", "borsha", "bhor",
  "tara", "tuhin", "titir", "tori", "phul", "pakhi", "pahar", "projapoti",
] as const;

const SECOND = [
  "deep", "dhara", "dola", "doyal", "dheu", "din", "dishari", "durbar",
  "jhor", "jol", "jyoti", "jiban", "joy", "jhorna", "juthi", "jagoron",
  "kajol", "kusum", "koli", "kiron", "kotha", "khushi", "kabya", "kanon",
  "lata", "lalon", "chand", "chaya", "chithi", "chorui", "cholona", "chayan",
  "rodh", "rupali", "rongin", "ritu", "robi", "rakhi", "rohoshyo", "ronjon",
  "shapla", "shiuli", "sheuli", "sraboni", "basanta", "bokul", "bela", "binni",
] as const;

/** `word-word-NNNN`, e.g. `shanto-alo-4721`. Never derived from the phone number. */
export function generateUsername(): string {
  return `${FIRST[randomInt(FIRST.length)]}-${SECOND[randomInt(SECOND.length)]}-${randomInt(1000, 10000)}`;
}

/** Shape check for anything that claims to be a username (admin search, URLs). */
export function isUsername(value: unknown): value is string {
  return typeof value === "string" && /^[a-z]{2,16}-[a-z]{2,16}-[1-9][0-9]{2,3}$/.test(value);
}
