begin;
create table public.gcas_preparations (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 package text not null check(package in ('single','couple','family')),
 version text not null, year integer not null,
 payload jsonb not null default '{"documents":[]}'::jsonb,
 revision integer not null default 0, state text not null default 'unpaid' check(state in ('unpaid','paid','revoked','deleted')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 check (octet_length(payload::text) <= 524288)
);
create index gcas_preparations_owner on public.gcas_preparations(owner_id);
create table public.gcas_orders (
 id uuid primary key default gen_random_uuid(), preparation_id uuid not null references public.gcas_preparations(id),
 session_id text unique, payment_id text unique, amount integer not null check(amount in (999,1999,2999)),
 state text not null default 'pending' check(state in ('pending','paid','expired','failed','revoked')),
 checkout_url text, created_at timestamptz not null default now()
);
create unique index gcas_one_pending_order on public.gcas_orders(preparation_id) where state='pending';
create table public.gcas_assets (
 id uuid primary key, preparation_id uuid not null references public.gcas_preparations(id) on delete cascade,
 document_id uuid not null, field_id text not null, object_path text unique not null,
 bytes integer not null, width integer not null, height integer not null,
 created_at timestamptz not null default now()
);
create index gcas_assets_preparation on public.gcas_assets(preparation_id);
create table public.gcas_storage_cleanup (object_path text primary key, created_at timestamptz not null default now());
create table public.gcas_stripe_events (id text primary key, type text not null, received_at timestamptz not null default now());
create table public.gcas_rate_limits (key text primary key, window_start timestamptz not null, hits integer not null);
create table public.gcas_deliveries (
 id uuid primary key default gen_random_uuid(), preparation_id uuid not null references public.gcas_preparations(id),
 revision integer not null, state text not null default 'pending' check(state in ('pending','sent','failed')),
 created_at timestamptz not null default now(), sent_at timestamptz
);
-- No client mutations, including entitlement fields. RLS is defense in depth.
alter table public.gcas_preparations enable row level security;
alter table public.gcas_orders enable row level security;
alter table public.gcas_assets enable row level security;
alter table public.gcas_storage_cleanup enable row level security;
alter table public.gcas_stripe_events enable row level security;
alter table public.gcas_rate_limits enable row level security;
alter table public.gcas_deliveries enable row level security;
revoke all on public.gcas_preparations,public.gcas_orders,public.gcas_assets,public.gcas_storage_cleanup,public.gcas_stripe_events,public.gcas_rate_limits,public.gcas_deliveries from anon,authenticated;
grant select on public.gcas_preparations to authenticated;
create policy gcas_owner_read on public.gcas_preparations for select to authenticated using (owner_id=(select auth.uid()) and state='paid' and expires_at>now());
grant all on public.gcas_preparations,public.gcas_orders,public.gcas_assets,public.gcas_storage_cleanup,public.gcas_stripe_events,public.gcas_rate_limits,public.gcas_deliveries to service_role;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('gcas-private','gcas-private',false,5242880,array['image/jpeg']) on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg'];
-- Bucket has no anonymous/authenticated policies. Only the verified API accesses it.
create function public.gcas_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql set search_path='' as $$
declare allowed boolean;
begin
 insert into public.gcas_rate_limits as r values(p_key,now(),1)
 on conflict(key) do update set hits=case when r.window_start<now()-make_interval(secs=>p_seconds) then 1 else r.hits+1 end,
 window_start=case when r.window_start<now()-make_interval(secs=>p_seconds) then now() else r.window_start end
 returning hits<=p_limit into allowed;
 return allowed;
end $$;
create function public.gcas_save(p_id uuid,p_owner uuid,p_revision integer,p_payload jsonb) returns public.gcas_preparations language plpgsql set search_path='' as $$
declare result public.gcas_preparations;
begin
 update public.gcas_preparations set payload=p_payload,revision=revision+1,updated_at=now(),expires_at=now()+interval '365 days'
 where id=p_id and owner_id=p_owner and revision=p_revision and state='paid' and expires_at>now() returning * into result;
 if result.id is null then raise exception 'Save conflict or access unavailable' using errcode='40001'; end if;
 return result;
end $$;
create function public.gcas_payment(p_event text,p_type text,p_order uuid,p_session text,p_payment text,p_amount integer,p_paid boolean) returns void language plpgsql set search_path='' as $$
declare o public.gcas_orders; event_new text;
begin
 insert into public.gcas_stripe_events(id,type) values(p_event,p_type) on conflict do nothing returning id into event_new;
 if event_new is null then return; end if;
 select * into o from public.gcas_orders where id=p_order for update;
 if o.id is null or o.amount<>p_amount or (o.session_id is not null and o.session_id<>p_session) then raise exception 'Payment mismatch'; end if;
 if o.state='revoked' then return; end if;
 update public.gcas_orders set session_id=p_session,payment_id=p_payment,state=case when p_paid then 'paid' else 'revoked' end where id=p_order;
 update public.gcas_preparations set state=case when p_paid then 'paid' else 'revoked' end,
 expires_at=case when p_paid then now()+interval '365 days' else expires_at end where id=o.preparation_id and state<>'deleted';
end $$;
create function public.gcas_delete(p_id uuid,p_owner uuid) returns void language plpgsql set search_path='' as $$
begin
 perform 1 from public.gcas_preparations where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'Not found'; end if;
 insert into public.gcas_storage_cleanup(object_path) select object_path from public.gcas_assets where preparation_id=p_id on conflict do nothing;
 delete from public.gcas_assets where preparation_id=p_id;
 update public.gcas_preparations set payload='{"documents":[]}'::jsonb,state='deleted',revision=revision+1,updated_at=now() where id=p_id;
end $$;
create function public.gcas_expire() returns void language plpgsql set search_path='' as $$
declare p record;
begin
 for p in select id,owner_id from public.gcas_preparations where state<>'deleted' and expires_at<now() loop
 perform public.gcas_delete(p.id,p.owner_id);
 end loop;
 -- Uploaded but never referenced by a successful save: clean up after one day.
 insert into public.gcas_storage_cleanup(object_path) select a.object_path from public.gcas_assets a join public.gcas_preparations p on p.id=a.preparation_id
 where a.created_at<now()-interval '1 day' and not jsonb_path_exists(p.payload,'$.documents[*].assets.* ? (@.id == $id)',jsonb_build_object('id',a.id::text)) on conflict do nothing;
 delete from public.gcas_assets where object_path in (select object_path from public.gcas_storage_cleanup);
 delete from public.gcas_rate_limits where window_start<now()-interval '1 day';
end $$;
revoke all on function public.gcas_limit(text,integer,integer),public.gcas_save(uuid,uuid,integer,jsonb),public.gcas_payment(text,text,uuid,text,text,integer,boolean),public.gcas_delete(uuid,uuid),public.gcas_expire() from public,anon,authenticated;
grant execute on function public.gcas_limit(text,integer,integer),public.gcas_save(uuid,uuid,integer,jsonb),public.gcas_payment(text,text,uuid,text,text,integer,boolean),public.gcas_delete(uuid,uuid),public.gcas_expire() to service_role;
commit;
