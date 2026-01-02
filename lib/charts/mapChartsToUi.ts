import type {
  ChartPlaylistCard,
  ChartSnapshotEntry,
  ChartTopArtist,
} from "@/components/charts/types";

type PeriodRow = {
  period_start: string | null;
  period_end: string | null;
};

export type RegisteredArtistProfile = {
  user_id: string;
  artist_name?: string | null;
  slug?: string | null;
  ig_profile_picture?: string | null;
  artist_photo_url?: string | null;
  photo_url?: string | null;
  avatar_url?: string | null;
};

type ChartBlueprint = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  highlightSource: ChartSnapshotEntry[];
};

export type ChartUiModel = {
  periodStart: string | null;
  periodEnd: string | null;
  topArtists: ChartTopArtist[];
  playlists: ChartPlaylistCard[];
  globalTop100: ChartSnapshotEntry[];
  qualityTop10: ChartSnapshotEntry[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function getNum(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStr(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildTopArtists(
  globalRows: ChartSnapshotEntry[],
  registeredProfiles?: RegisteredArtistProfile[]
) {
  const candidateMap = new Map<
    string,
    { bestRank: number; bestScore: number }
  >();

  const addCandidate = (identityKey: string, entry: ChartSnapshotEntry) => {
    const key = identityKey.toString().trim();
    if (!key) return;

    const existing = candidateMap.get(key);
    const bestRank = Math.min(
      existing?.bestRank ?? Number.POSITIVE_INFINITY,
      entry.rank_position
    );
    const bestScore = Math.max(
      existing?.bestScore ?? Number.NEGATIVE_INFINITY,
      entry.score_public ?? 0
    );

    candidateMap.set(key, { bestRank, bestScore });
  };

  for (const entry of globalRows) {
    const ownerKey = (entry.artist_id ?? "").toString().trim();
    if (ownerKey) addCandidate(ownerKey, entry);

    const record = isRecord(entry) ? entry : null;
    const collabIdsRaw = record?.collab_artist_ids;
    if (Array.isArray(collabIdsRaw)) {
      collabIdsRaw
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        .forEach((id) => addCandidate(id, entry));
    }
  }

  const registeredMap = new Map<string, RegisteredArtistProfile>();
  (registeredProfiles ?? []).forEach((profile) => {
    if (profile?.user_id) {
      registeredMap.set(profile.user_id, profile);
    }
  });

  const sortedCandidates = Array.from(candidateMap.entries()).sort(
    (a, b) => {
      const rankDiff = a[1].bestRank - b[1].bestRank;
      if (rankDiff !== 0) return rankDiff;
      return b[1].bestScore - a[1].bestScore;
    }
  );

  const topArtists: ChartTopArtist[] = [];
  for (const [key, stats] of sortedCandidates) {
    const matchedRow = globalRows.find(
      (row) => (row.artist_id ?? "").toString().trim() === key
    );
    const rowRecord = isRecord(matchedRow) ? matchedRow : null;
    const avatarFromRows = rowRecord ? getStr(rowRecord, "__artist_avatar_url") : null;
    const slugFromRows = rowRecord ? getStr(rowRecord, "artist_slug") : null;

    const registeredProfile = registeredMap.get(key);
    const displayName =
      registeredProfile?.artist_name?.trim() ||
      registeredProfile?.artist_name ||
      getStr(rowRecord, "artist_name") ||
      "Tekkin Artist";
    const avatarUrl =
      registeredProfile?.ig_profile_picture ??
      registeredProfile?.artist_photo_url ??
      registeredProfile?.avatar_url ??
      registeredProfile?.photo_url ??
      avatarFromRows ??
      null;
    const slug =
      registeredProfile?.slug ??
      (typeof slugFromRows === "string" && slugFromRows.trim() ? slugFromRows.trim() : null);

    topArtists.push({
      id: registeredProfile?.user_id ?? key,
      name: displayName,
      avatarUrl,
      score: stats.bestScore,
      slug,
    });

    if (topArtists.length >= 12) break;
  }

  return topArtists;
}

function buildPlaylists(
  globalTop100: ChartSnapshotEntry[],
  qualityTop10: ChartSnapshotEntry[]
) {
  const blueprint: ChartBlueprint[] = [
    {
      id: "minimal",
      title: "Minimal Deep Tech",
      description: "Selezione per groove e mix pulito.",
      imageUrl: "https://images.unsplash.com/photo-1526948128573-703ee1aeb6fa?w=800&q=80",
      highlightSource: qualityTop10,
    },
    {
      id: "techhouse",
      title: "Tech House Modern",
      description: "Energy + bounce, club ready.",
      imageUrl: "https://images.unsplash.com/photo-1464375117522-1311d6a5b32b?w=800&q=80",
      highlightSource: globalTop100.slice(0, 5),
    },
    {
      id: "deephouse",
      title: "Deep House",
      description: "Warm, deep, late night.",
      imageUrl: "https://images.unsplash.com/photo-1470229538611-16ba8c7ffbd7?w=800&q=80",
      highlightSource: globalTop100.slice(5, 10),
    },
    {
      id: "house",
      title: "House",
      description: "Classic pulse, modern polish.",
      imageUrl: "https://images.unsplash.com/photo-1485579149621-3123dd979885?w=800&q=80",
      highlightSource: globalTop100.slice(10, 15),
    },
    {
      id: "fresh",
      title: "Fresh Releases",
      description: "Uscite recenti con boost temporale.",
      imageUrl: "https://images.unsplash.com/photo-1507878866276-a947ef722fee?w=800&q=80",
      highlightSource: globalTop100.slice(15, 20),
    },
  ];

  return blueprint.map<ChartPlaylistCard>((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    imageUrl: item.imageUrl,
  }));
}

export function mapChartsToUi(
  rows: ChartSnapshotEntry[],
  registeredProfiles?: RegisteredArtistProfile[],
  period?: PeriodRow | null
): ChartUiModel {
  const safeRows = Array.isArray(rows) ? [...rows] : [];

  const globalTop100 = safeRows
    .filter((row) => row.profile_key === "global")
    .sort((a, b) => a.rank_position - b.rank_position)
    .slice(0, 100)
    .map((r) => {
      const record: Record<string, unknown> = isRecord(r) ? r : ({} as Record<string, unknown>);
      return {
        ...r,
        likes: getNum(record, "likes") ?? 0,
        liked: Boolean(record["liked"]),
      };
    });

  const qualityTop10 = safeRows
    .filter((row) => row.profile_key === "quality")
    .sort((a, b) => a.rank_position - b.rank_position)
    .slice(0, 10)
    .map((r) => {
      const record: Record<string, unknown> = isRecord(r) ? r : ({} as Record<string, unknown>);
      return {
        ...r,
        likes: getNum(record, "likes") ?? 0,
        liked: Boolean(record["liked"]),
      };
    });

  return {
    periodStart: period?.period_start ?? null,
    periodEnd: period?.period_end ?? null,
    topArtists: buildTopArtists(globalTop100, registeredProfiles),
    playlists: buildPlaylists(globalTop100, qualityTop10),
    globalTop100,
    qualityTop10,
  };
}
