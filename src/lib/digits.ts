const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Bengali digits (০-৯) to Latin (0-9); everything else untouched. Phone and OTP fields share it (E1). */
export function toLatinDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/** Keeps only digits (either script), returned as Latin digits. */
export function onlyDigits(input: string): string {
  return toLatinDigits(input).replace(/\D/g, "");
}
