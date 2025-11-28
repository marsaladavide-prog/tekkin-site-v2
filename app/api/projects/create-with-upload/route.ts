import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Supabase auth error:", authError);
      return NextResponse.json({ error: "Auth error" }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const status = (formData.get("status") as string | null) ?? "DEMO";

    if (!file || !title) {
      return NextResponse.json(
        { error: "Missing file or title" },
        { status: 400 }
      );
    }

    // Upload su Storage
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}_${user.id}.${fileExt}`;
    const filePath = `user_${user.id}/${fileName}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("tracks")
      .upload(filePath, fileBuffer, {
        contentType: file.type || "audio/mpeg",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    // 1) Creazione record in projects
    const { data: project, error: insertError } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        title,
        status,
        bpm: null,
        track_key: null,
        artist_name: null,
      })
      .select()
      .single();

    if (insertError || !project) {
      console.error("Insert project error:", insertError);
      return NextResponse.json({ error: "DB insert failed" }, { status: 500 });
    }

    // 2) Creazione record in project_versions
    const { error: versionError } = await supabase
      .from("project_versions")
      .insert({
        project_id: project.id,
        version_name: "v1",
        audio_url: filePath, // salviamo il path nello storage, non una URL pubblica
        lufs: null,
        sub_clarity: null,
        hi_end: null,
        dynamics: null,
        stereo_image: null,
        tonality: null,
        overall_score: null,
        feedback: null,
      });

    if (versionError) {
      console.error("Insert project_version error:", versionError);
      // non blocco la risposta, ma loggo per debug
    }

    return NextResponse.json({ project }, { status: 200 });
  } catch (err) {
    console.error("Unexpected error in create-with-upload:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
