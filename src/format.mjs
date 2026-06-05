/** Sizes as French readers expect them: « 12,3 Ko », « 1,05 Mo » (1 Ko = 1000 octets). */
export function formatSize(bytes) {
  if (bytes < 1000) return `${bytes} o`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1).replace('.', ',')} Ko`;
  return `${(bytes / 1_000_000).toFixed(2).replace('.', ',')} Mo`;
}
