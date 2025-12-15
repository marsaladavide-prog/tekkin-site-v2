import { NextRequest, NextResponse } from "next/server";
import { getArtistDetail } from "@/lib/artist/discovery/getArtistDetail";

type RouteContext = {
  params: Promise<{ artistId: string }>;
};

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { artistId } = await ctx.params;

  const data = await getArtistDetail(artistId);

  if (data.error) {
    const status =
      data.error === "ID artista non valido" ? 400 : data.artist ? 500 : 404;
    return NextResponse.json({ error: data.error }, { status });
  }

  return NextResponse.json(data, { status: 200 });
}
