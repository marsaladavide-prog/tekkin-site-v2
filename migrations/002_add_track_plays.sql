-- migrations/002_add_track_plays.sql

CREATE TABLE IF NOT EXISTS tekkin_track_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL,
  viewer_id TEXT NOT NULL,
  bucket_hour TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tekkin_track_plays_unique
  ON tekkin_track_plays (version_id, viewer_id, bucket_hour);

CREATE INDEX IF NOT EXISTS idx_tekkin_track_plays_version
  ON tekkin_track_plays (version_id);

CREATE OR REPLACE FUNCTION tekkin_track_play_v1(p_version_id UUID, p_viewer_id TEXT)
  RETURNS BOOLEAN
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  bucket TIMESTAMPTZ := date_trunc('hour', now());
  inserted BOOLEAN := FALSE;
BEGIN
  INSERT INTO tekkin_track_plays (version_id, viewer_id, bucket_hour)
    VALUES (p_version_id, p_viewer_id, bucket)
    ON CONFLICT (version_id, viewer_id, bucket_hour) DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT > 0;
  RETURN inserted;
END;
$$;
