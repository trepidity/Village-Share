-- Fix: village creator can't read back their own row during INSERT...RETURNING
-- because the AFTER INSERT trigger (which adds them to village_members) hasn't
-- fired yet when the RETURNING clause evaluates the SELECT policy.

drop policy "Village members can view their villages" on public.villages;
create policy "Village members can view their villages"
  on public.villages for select
  using (
    created_by = (select auth.uid())
    or public.is_village_member(id)
  );
