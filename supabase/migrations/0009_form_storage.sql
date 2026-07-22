-- Running form analysis: private video storage + owner-scoped access.
-- Videos live at  form-videos/{user_id}/{analysis_id}.mp4  and auto-expire via
-- the 30-day cleanup below (keypoints + report persist in form_analyses).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('form-videos', 'form-videos', false, 104857600,
        array['video/mp4','video/quicktime'])
on conflict (id) do nothing;

-- Owner-only access; the first path segment must be the user's id.
create policy form_videos_select on storage.objects
  for select using (
    bucket_id = 'form-videos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy form_videos_insert on storage.objects
  for insert with check (
    bucket_id = 'form-videos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy form_videos_delete on storage.objects
  for delete using (
    bucket_id = 'form-videos' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Nightly: delete expired analysis videos from storage, keeping the report.
create or replace function public.purge_expired_form_videos()
returns void language plpgsql security definer set search_path = public, storage as $$
begin
  delete from storage.objects o
  using form_analyses f
  where o.bucket_id = 'form-videos'
    and f.video_path = o.name
    and f.expires_at < now();
  update form_analyses set video_path = null
   where expires_at < now() and video_path is not null;
end $$;

select cron.schedule('stride-purge-form-videos', '30 3 * * *',
  $$ select public.purge_expired_form_videos() $$);

-- Form-analysis drills for the curated recommendation library.
insert into public.exercise_library (slug, name, category, target_areas, instructions_md, evidence_level) values
('cadence-metronome', 'Cadence Metronome Runs', 'drill', '{form,cadence}',
 'Run 4×1 min to a metronome set 5–8 steps/min above your current cadence, easy effort. Retrains a quicker, lighter turnover.', 'moderate'),
('running-tall-cue', 'Run Tall Posture Cue', 'drill', '{form,posture}',
 'Every few minutes, imagine a string lifting the crown of your head; lean gently from the ankles, not the waist. Resets trunk position.', 'weak'),
('butt-kicks', 'Butt Kicks', 'drill', '{form,hamstring}',
 '2×20 m bringing heels toward the glutes with quick turnover. Encourages a compact, efficient recovery leg.', 'moderate'),
('single-leg-rdl', 'Single-Leg RDL', 'strength', '{glute,hamstring,hip}',
 '3×8 per side, slow. Builds the single-leg stability that reduces hip drop and side-to-side asymmetry.', 'strong')
on conflict (slug) do nothing;
