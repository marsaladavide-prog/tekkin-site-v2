-- Add waveform_bands jsonb column to store per-band envelopes from the analyzer.
ALTER TABLE project_versions
ADD COLUMN IF NOT EXISTS waveform_bands jsonb;
