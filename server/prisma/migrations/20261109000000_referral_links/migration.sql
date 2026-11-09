-- Additive, server-only referral ledger. Existing users/friendIds remain compatible.
CREATE TABLE public.referral_links (
  token TEXT PRIMARY KEY,
  "inviterId" TEXT NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.referral_redemptions (
  "inviteeId" TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  "inviterId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL REFERENCES public.referral_links(token) ON DELETE CASCADE,
  "rewardCoins" INTEGER NOT NULL DEFAULT 0 CHECK ("rewardCoins" IN (0, 100)),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("inviteeId" <> "inviterId")
);
CREATE INDEX referral_redemptions_inviter_idx ON public.referral_redemptions ("inviterId");
ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_links, public.referral_redemptions FROM anon, authenticated;
