import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // 1) auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) payload
    const body = await req.json();
    const { version_id, peaks, duration, points } = body ?? {};

    if (
      !version_id ||
      !Array.isArray(peaks) ||
      peaks.length === 0 ||
      typeof duration !== "number"
    ) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    // 3) verifica ownership
    const { data: version, error: versionError } = await supabase
      .from("project_versions")
      .select("id, project_id")
      .eq("id", version_id)
      .single();

    if (versionError || !version) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, user_id")
      .eq("id", version.project_id)
      .single();

    if (projectError || !project || project.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // 4) salva peaks (una volta)
    const { error: updateError } = await supabase
      .from("project_versions")
      .update({
        waveform_peaks: peaks,
        waveform_duration: duration,
        waveform_peaks_points: points ?? peaks.length,
        waveform_peaks_updated_at: new Date().toISOString(),
      })
      .eq("id", version_id)
      .is("waveform_peaks", null); // IMPORTANTISSIMO: non sovrascrive

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save peaks" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("save-waveform-peaks error", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
