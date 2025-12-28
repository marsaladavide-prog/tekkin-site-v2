-- Ensure waveform columns exist for project_versions.
ALTER TABLE project_versions
  ADD COLUMN IF NOT EXISTS waveform_peaks jsonb,
  ADD COLUMN IF NOT EXISTS waveform_duration double precision,
  ADD COLUMN IF NOT EXISTS waveform_bands jsonb;
