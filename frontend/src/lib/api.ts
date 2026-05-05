// En production Electron, Next.js standalone ne proxifie pas /api/* → port 8000
// On détecte si on est dans Electron via la variable d'env injectée par electron/main.js
const API_BASE =
  typeof window !== "undefined" &&
  (window as unknown as Record<string, unknown>).__ELECTRON__
    ? "http://localhost:8000"
    : "";

export interface Job {
  job_id: string;
  created_at: number;
  has_original: boolean;
  stems_ready: boolean;
  size_bytes: number;
  size_mb: number;
  name?: string | null;
  favorite?: boolean;
  duration_s?: number | null;
}

export interface Stems {
  vocals: string;
  drums: string;
  bass: string;
  other: string;
}

export async function uploadFile(file: File): Promise<{ job_id: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/input`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function importYoutube(url: string): Promise<{ job_id: string }> {
  const formData = new FormData();
  formData.append("youtube_url", url);
  const res = await fetch(`${API_BASE}/api/input`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getStems(jobId: string): Promise<{ stems: Stems }> {
  const res = await fetch(`${API_BASE}/api/tracks/${jobId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getBpm(
  jobId: string,
): Promise<{ bpm: number; first_beat: number }> {
  const res = await fetch(`${API_BASE}/api/bpm/${jobId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listJobs(): Promise<{ jobs: Job[] }> {
  const res = await fetch(`${API_BASE}/api/jobs`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function renameJob(jobId: string, name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}/name`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function setFavorite(
  jobId: string,
  favorite: boolean,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}/favorite`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ favorite }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/api/jobs/${jobId}`, { method: "DELETE" });
}

export async function exportMix(
  jobId: string,
  mutedStems: string[],
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, muted_stems: mutedStems }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}

export async function exportDawPack(jobId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/export/daw/${jobId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}

export function stemStreamUrl(jobId: string, stem: string): string {
  return `${API_BASE}/api/stream/${jobId}/${stem}.mp3`;
}
