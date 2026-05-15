/**
 * Lightweight email shape check (not full RFC): single @, local part, domain with dot, TLD letters length ≥ 2.
 */
export function isValidEmailFormat(value: string): boolean {
  const s = value.trim();
  if (!s || s.length > 254) return false;
  const parts = s.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (!/^[a-zA-Z0-9._%+-]+$/.test(local)) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  if (tld.length < 2 || !/^[a-zA-Z]+$/u.test(tld)) return false;
  for (const label of labels) {
    if (!label || label.startsWith('-') || label.endsWith('-')) return false;
    if (!/^[a-zA-Z0-9-]+$/.test(label)) return false;
  }
  return true;
}
