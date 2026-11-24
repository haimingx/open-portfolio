const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export const isAddress = (value: string) => ADDRESS.test(value.trim());
export const normalizeAddress = (value: string) => value.trim().toLowerCase();

// Addresses are normalized here; input with a dot goes to the server as an ENS name, so the browser bundle carries no ENS normalization data.
export function walletSegment(input: string): string | null {
  const value = input.trim();
  if (isAddress(value)) return normalizeAddress(value);
  return value.includes('.') && !/[\s/]/.test(value) ? encodeURIComponent(value) : null;
}
