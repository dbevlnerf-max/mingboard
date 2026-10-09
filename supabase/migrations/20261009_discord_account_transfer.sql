-- Discord character account purchase / ownership transfer. 
-- Migration applied via Supabase before the API rollout.
CREATE TABLE IF NOT EXISTS public.guild_account_transfer_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 guild_id text NOT NULL,
 gid bigint NOT NULL CHECK (gid > 0),
 character_nickname text NOT NULL,
 buyer_discord_id text NOT NULL,
 buyer_discord_name text NOT NULL DEFAULT '',
 evidence_reference text NOT NULL CHECK (length(evidence_reference) BETWEEN 8 AND 1000),
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 decided_by text,
 verification_note text,
 previous_links jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS guild_account_transfer_one_pending_per_gid
 ON public.guild_account_transfer_requests(guild_id,gid) WHERE state='pending';
CREATE INDEX IF NOT EXISTS guild_account_transfer_request_buyer_idx
 ON public.guild_account_transfer_requests(buyer_discord_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.guild_account_ownership (
 gid bigint PRIMARY KEY,
 owner_discord_id text NOT NULL,
 last_transfer_id uuid REFERENCES public.guild_account_transfer_requests(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.guild_account_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_account_ownership ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guild_account_transfer_requests, public.guild_account_ownership FROM anon,authenticated;
GRANT ALL ON TABLE public.guild_account_transfer_requests, public.guild_account_ownership TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_transferred_account_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE locked_owner text;
BEGIN
 SELECT owner_discord_id INTO locked_owner FROM public.guild_account_ownership WHERE gid=NEW.gid;
 IF locked_owner IS NOT NULL AND locked_owner <> NEW.discord_id THEN
  RAISE EXCEPTION '이 캐릭터는 소유권 이전된 계정입니다. 운영진의 승인이 필요합니다.';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS verify_transferred_owner ON public.guild_member_discord_links;
CREATE TRIGGER verify_transferred_owner
BEFORE INSERT OR UPDATE OF gid,discord_id,revoked_at ON public.guild_member_discord_links
FOR EACH ROW EXECUTE FUNCTION public.enforce_transferred_account_owner();

CREATE OR REPLACE FUNCTION public.approve_guild_account_transfer(
 p_request_id uuid, p_admin_id text, p_verification_note text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 req public.guild_account_transfer_requests%ROWTYPE;
 old_links jsonb;
 previous_ids text[];
 new_link public.guild_member_discord_links%ROWTYPE;
BEGIN
 IF length(trim(coalesce(p_admin_id,''))) < 8 OR length(trim(coalesce(p_verification_note,''))) < 10
 THEN RAISE EXCEPTION '운영진 ID 및 확인 메모(10자 이상)가 필요합니다.'; END IF;
 SELECT * INTO req FROM public.guild_account_transfer_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '해당 계정 이전 신청을 찾을 수 없습니다.'; END IF;
 IF req.state <> 'pending' THEN RAISE EXCEPTION '이미 처리된 신청입니다.'; END IF;
 IF req.buyer_discord_id=p_admin_id THEN RAISE EXCEPTION '신청자 본인은 승인할 수 없습니다.'; END IF;
 PERFORM pg_advisory_xact_lock(req.gid);
 IF EXISTS(SELECT 1 FROM public.guild_member_states WHERE gid=req.gid AND status='left') THEN
  RAISE EXCEPTION '탈퇴한 캐릭터는 이전할 수 없습니다.'; END IF;
 IF EXISTS(SELECT 1 FROM public.guild_member_discord_links WHERE discord_id=req.buyer_discord_id) THEN
  RAISE EXCEPTION '구매자 디스코드 계정에 기존 연결 이력이 있습니다. 운영진이 확인해야 합니다.'; END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at),'[]'::jsonb),
        COALESCE(array_agg(x.discord_id ORDER BY x.created_at),'{}'::text[])
 INTO old_links, previous_ids FROM public.guild_member_discord_links x WHERE x.gid=req.gid;
 UPDATE public.guild_account_transfer_requests SET
  state='approved',decided_at=now(),decided_by=p_admin_id,
  verification_note=trim(p_verification_note),previous_links=old_links
 WHERE id=req.id;
 DELETE FROM public.guild_member_discord_links WHERE gid=req.gid;
 INSERT INTO public.guild_account_ownership(gid,owner_discord_id,last_transfer_id,updated_at)
 VALUES(req.gid,req.buyer_discord_id,req.id,now())
 ON CONFLICT(gid) DO UPDATE SET owner_discord_id=EXCLUDED.owner_discord_id,
  last_transfer_id=EXCLUDED.last_transfer_id,updated_at=now();
 INSERT INTO public.guild_member_discord_links(
  gid,discord_id,discord_username,discord_display_name,account_type
 ) VALUES(req.gid,req.buyer_discord_id,req.buyer_discord_name,req.buyer_discord_name,'primary')
 RETURNING * INTO new_link;
 RETURN jsonb_build_object(
  'id',req.id,'gid',req.gid,'nickname',req.character_nickname,
  'buyerDiscordId',req.buyer_discord_id,'previousDiscordIds',to_jsonb(previous_ids),
  'state','approved','newLinkId',new_link.id);
END;
$$;
REVOKE ALL ON FUNCTION public.approve_guild_account_transfer(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_guild_account_transfer(uuid,text,text) TO service_role;
