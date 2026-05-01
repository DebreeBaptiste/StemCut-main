export interface Job {
  job_id: string
  created_at: number
  has_original: boolean
  stems_ready: boolean
  size_bytes: number
  size_mb: number
}

export interface Stems {
  vocals: string
  drums: string
  bass: string
  other: string
}

export async function uploadFile(file: File): Promise<{ job_id: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/input', { method: 'POST', body: formData })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function importYoutube(url: string): Promise<{ job_id: string }> {
  const formData = new FormData()
  formData.append('youtube_url', url)
  const res = await fetch('/api/input', { method: 'POST', body: formData })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getStems(jobId: string): Promise<{ stems: Stems }> {
  const res = await fetch(`/api/tracks/${jobId}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function listJobs(): Promise<{ jobs: Job[] }> {
  const res = await fetch('/api/jobs')
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function deleteJob(jobId: string): Promise<void> {
  await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
}

export async function exportMix(jobId: string, mutedStems: string[]): Promise<Blob> {
  const res = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId, muted_stems: mutedStems }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.blob()
}

export function stemStreamUrl(jobId: string, stem: string): string {
  return `/api/stream/${jobId}/${stem}.mp3`
}
