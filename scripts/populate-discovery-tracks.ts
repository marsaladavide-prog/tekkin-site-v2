#!/usr/bin/env ts-node

/**
 * Script per popolare discovery_tracks con l'ultima versione audio per progetto.
 * Esegue upsert utilizzando il client admin su Supabase.
 * Richiede NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env.local");

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type VersionRow = {
  id: string;
  project_id: string;
  audio_path: string | null;
  audio_url: string | null;
  genre: string | null;
  overall_score: number | null;
  mix_score: number | null;
  master_score: number | null;
  bass_energy: number | null;
  has_vocals: boolean | null;
  bpm: number | null;
  projects: { id: string; user_id: string }[];
};

async function main() {
  const { data, error } = await admin
    .from("project_versions")
    .select(
      "id, project_id, audio_path, audio_url, overall_score, bpm, projects(id, user_id)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to fetch project_versions:", error);
    process.exit(1);
  }

  const latestByProject = new Map<string, VersionRow>();

  for (const version of data ?? []) {
    if (!version?.project_id) continue;
    if (!latestByProject.has(version.project_id)) {
      latestByProject.set(version.project_id, version);
    }
  }

  for (const version of latestByProject.values()) {
    const project = Array.isArray(version.projects)
      ? version.projects[0]
      : version.projects;
    if (!project) continue;

    const audioValue =
      version.audio_path?.trim() ||
      version.audio_url?.trim() ||
      null;

    if (!audioValue) continue;

    await admin.from("discovery_tracks").upsert(
      {
        owner_id: project.user_id,
        project_id: version.project_id,
        genre: null,
        overall_score: version.overall_score,
        bpm: version.bpm,
        is_enabled: true,
        audio_url: audioValue,
      },
      { onConflict: "project_id" }
    );

    console.log(`Seeded discovery_tracks for project ${version.project_id}`);
  }

  console.log("Done.");
}

void main().catch((err) => {
  console.error("Unexpected error", err);
  process.exit(1);
});
