begin;
create function public.gcas_asset_guard() returns trigger language plpgsql set search_path='' as $$
begin
 perform 1 from public.gcas_preparations where id=new.preparation_id and state='paid' and expires_at>now() for update;
 if not found then raise exception 'Preparation unavailable'; end if;
 if (select count(*) from public.gcas_assets where preparation_id=new.preparation_id)>=512
 or (select coalesce(sum(bytes),0) from public.gcas_assets where preparation_id=new.preparation_id)+new.bytes>536870912 then
 raise exception 'Private file capacity reached'; end if;
 return new;
end $$;
create trigger gcas_guard_asset before insert on public.gcas_assets for each row execute function public.gcas_asset_guard();
revoke all on function public.gcas_asset_guard() from public,anon,authenticated;
commit;
