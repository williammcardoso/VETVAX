const LEGACY_IMPORT_PATTERN = /sistema antigo/i;

/** Hides raw migration metadata ("Importado do sistema antigo. indice=... codCli=...") from the UI. */
export function displayReminderNotes(notes: string | null | undefined) {
  if (!notes) return null;
  if (LEGACY_IMPORT_PATTERN.test(notes)) return null;
  return notes;
}
