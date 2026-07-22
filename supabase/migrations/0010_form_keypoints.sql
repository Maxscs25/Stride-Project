-- Store the downsampled pose keypoints alongside each analysis so the results
-- screen can animate a skeleton of the detected motion. Kept in its own column
-- so the analyses list query doesn't have to pull them.

alter table public.form_analyses
  add column if not exists keypoints jsonb;
