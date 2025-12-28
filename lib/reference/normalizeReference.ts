import type { GenreReference } from "@/lib/reference/types";

function nullToUndef(n: number | null | undefined) {
  return n === null ? undefined : n;
}

export function normalizeReferenceForPreview(ref: GenreReference): GenreReference {
  const b = ref.bands_norm_stats;
  if (!b) return ref;

  return {
    ...ref,
    bands_norm_stats: Object.fromEntries(
      Object.entries(b).map(([k, v]) => [
        k,
        {
          ...v,
          mean: nullToUndef((v as any).mean),
          std: nullToUndef((v as any).std),
        },
      ])
    ) as any,
  };
}
