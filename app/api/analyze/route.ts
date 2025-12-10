import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { spawn } from "child_process";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const lang = (formData.get("lang") as string) || "it";
    const mode = (formData.get("mode") as string) || "master";
    const genre = (formData.get("genre") as string) || "minimal_deep_tech";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // === Percorsi temporanei ===
    const tempRoot = path.resolve(process.cwd(), "temp_files");
    await mkdir(tempRoot, { recursive: true });

    const wavPath = path.join(tempRoot, `${Date.now()}_upload.wav`);
    const plotsDir = path.join(tempRoot, `plots_${Date.now()}`);
    await mkdir(plotsDir, { recursive: true });

    // === Salva file ===
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(wavPath, buffer);

    // === Avvia Python come processo streaming ===
    const py = spawn(
      "python",
      [
        "-u", // output unbuffered
        "-Xutf8",
        path.resolve("analyze_master_web.py"),
        lang,
        genre,
        mode,
        wavPath,
        "--plots",
        "--plots-dir",
        plotsDir,
      ],
      {
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      }
    );

    // === Stream di output ===
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        py.stdout.on("data", (chunk) => {
          controller.enqueue(Buffer.from(chunk));
        });

        py.stderr.on("data", (chunk) => {
          const prefixed = Buffer.from("⚠️ " + chunk.toString(), "utf-8");
          controller.enqueue(prefixed);
        });

        py.on("close", async () => {
          controller.enqueue(
            Buffer.from("\n✅ Analisi completata.\n", "utf-8")
          );
          await unlink(wavPath).catch(() => {});
          controller.close();
        });
      },
    });

    // 👇 cast per far felice TS: ReadableStream -> BodyInit
    return new NextResponse(stream as unknown as BodyInit, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error: any) {
    console.error("Analyzer stream error:", error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
