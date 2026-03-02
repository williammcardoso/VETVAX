export function renderTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>,
) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    if (v === null || v === undefined) return "";
    return String(v);
  });
}
