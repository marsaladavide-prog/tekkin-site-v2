-- migrations/003_add_track_counters.sql

CREATE TABLE IF NOT EXISTS tekkin_track_counters (
  version_id UUID PRIMARY KEY,
  plays BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON tekkin_track_counters TO public;

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

  IF inserted THEN
    INSERT INTO tekkin_track_counters(version_id, plays, updated_at)
      VALUES (p_version_id, 1, now())
      ON CONFLICT (version_id) DO UPDATE
      SET plays = tekkin_track_counters.plays + 1,
          updated_at = now();
  END IF;

  RETURN inserted;
END;
$$;

-- Example usage:
-- SELECT plays FROM tekkin_track_counters WHERE version_id = '<some-uuid>';
