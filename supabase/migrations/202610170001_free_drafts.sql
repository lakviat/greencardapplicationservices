begin;
-- Saving/resuming belongs to the verified owner, independently of PDF payment.
drop policy gcas_owner_read on public.gcas_preparations;
create policy gcas_owner_read on public.gcas_preparations for select to authenticated
using (owner_id=(select auth.uid()) and state<>'deleted' and expires_at>now());

-- Idempotent registration reserves a private upload destination without creating an order.
create function public.gcas_draft(p_id uuid,p_owner uuid,p_package text,p_version text,p_year integer)
returns public.gcas_preparations language plpgsql set search_path='' as $$
declare result public.gcas_preparations;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 select * into result from public.gcas_preparations where id=p_id;
 if result.id is not null then
  if result.owner_id<>p_owner or result.state='deleted' or result.expires_at<=now() then
   raise exception 'Preparation unavailable' using errcode='42501';
  end if;
  return result;
 end if;
 if (select count(*) from public.gcas_preparations where owner_id=p_owner and state<>'deleted' and expires_at>now())>=50 then
  raise exception 'Draft capacity reached' using errcode='54000';
 end if;
 insert into public.gcas_preparations(id,owner_id,package,version,year)
 values(p_id,p_owner,p_package,p_version,p_year) returning * into result;
 return result;
end $$;
revoke all on function public.gcas_draft(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.gcas_draft(uuid,uuid,text,text,integer) to service_role;

-- Optional package preserves compatibility with an older API during deployment.
drop function public.gcas_save(uuid,uuid,integer,jsonb);
create function public.gcas_save(p_id uuid,p_owner uuid,p_revision integer,p_payload jsonb,p_package text default null)
returns public.gcas_preparations language plpgsql set search_path='' as $$
declare result public.gcas_preparations;
begin
 select * into result from public.gcas_preparations where id=p_id and owner_id=p_owner and state<>'deleted' and expires_at>now() for update;
 if result.id is null or result.revision<>p_revision then raise exception 'Save conflict or access unavailable' using errcode='40001'; end if;
 if p_package is not null and p_package<>result.package and
  (result.state<>'unpaid' or exists(select 1 from public.gcas_orders where preparation_id=p_id and state='pending')) then
  raise exception 'Package locked by purchase or checkout' using errcode='55000';
 end if;
 update public.gcas_preparations set payload=p_payload,package=coalesce(p_package,package),revision=revision+1,
 updated_at=now(),expires_at=now()+interval '365 days' where id=p_id returning * into result;
 return result;
end $$;
revoke all on function public.gcas_save(uuid,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.gcas_save(uuid,uuid,integer,jsonb,text) to service_role;

create or replace function public.gcas_asset_guard() returns trigger language plpgsql set search_path='' as $$
begin
 perform 1 from public.gcas_preparations where id=new.preparation_id and state<>'deleted' and expires_at>now() for update;
 if not found then raise exception 'Preparation unavailable'; end if;
 if (select count(*) from public.gcas_assets where preparation_id=new.preparation_id)>=512
 or (select coalesce(sum(bytes),0) from public.gcas_assets where preparation_id=new.preparation_id)+new.bytes>536870912 then
 raise exception 'Private file capacity reached'; end if;
 return new;
end $$;
-- Serialize order creation with package changes so a pending checkout cannot use a stale price.
create function public.gcas_order_guard() returns trigger language plpgsql set search_path='' as $$
declare selected text;
begin
 select package into selected from public.gcas_preparations where id=new.preparation_id and state='unpaid' and expires_at>now() for update;
 if selected is null or new.amount<>(case selected when 'single' then 999 when 'couple' then 1999 when 'family' then 2999 end) then
  raise exception 'Preparation or package changed' using errcode='55000';
 end if;
 return new;
end $$;
create trigger gcas_guard_order before insert on public.gcas_orders for each row execute function public.gcas_order_guard();
revoke all on function public.gcas_order_guard() from public,anon,authenticated;
commit;
