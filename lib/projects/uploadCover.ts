const COVER_UPLOAD_ENDPOINT = "/artist/projects/upload-cover";
export const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024;

type UploadCoverResponse = {
  cover_url?: string | null;
  error?: string | null;
};

export async function uploadProjectCover(projectId: string, file: File) {
  const formData = new FormData();
  formData.set("project_id", projectId);
  formData.set("file", file);

  const res = await fetch(COVER_UPLOAD_ENDPOINT, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const payload = (await res.json().catch(() => null)) as UploadCoverResponse | null;

  if (!res.ok) {
    const message = payload?.error ?? "Errore caricamento cover";
    throw new Error(message);
  }

  return { coverUrl: payload?.cover_url ?? null };
}
