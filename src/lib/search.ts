/** Lowercases and strips diacritics so "vitoria" matches "Vitória". */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Accent/case-insensitive substring match. Empty term always matches. */
export function matchesSearch(haystack: string | null | undefined, term: string): boolean {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return true;
  return normalizeSearchText(haystack).includes(normalizedTerm);
}

/** Accent/case-insensitive match against several fields at once (OR). */
export function matchesSearchAny(haystacks: Array<string | null | undefined>, term: string): boolean {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return true;
  return haystacks.some((h) => normalizeSearchText(h).includes(normalizedTerm));
}
