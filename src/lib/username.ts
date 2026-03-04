export function usernameToEmail(username: string) {
  const u = (username ?? "").trim().toLowerCase();
  return `${u}@vetvax.local`;
}
