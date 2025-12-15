import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ profileKey: string }> }
) {
  const { profileKey } = await ctx.params;

  try {
    const filePath = path.join(process.cwd(), "reference_models", `${profileKey}.json`);
    const raw = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(raw);
    return NextResponse.json(json, { status: 200 });
  } catch (_err) {
    return NextResponse.json(
      { error: "Reference not found", profileKey },
      { status: 404 }
    );
  }
}
