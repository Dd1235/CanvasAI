# Feature — Auth & per-user isolation

## What works ✅

- Supabase Auth with email/password, cookie-based sessions via `@supabase/ssr`.
- `frontend/proxy.ts` (Next 16's renamed middleware) refreshes session cookies and redirects:
  - unauth'd `/dashboard/*` → `/login?next=...`
  - auth'd `/login`, `/signup` → `/dashboard`
- Login form: shows confirmation-resend button if Supabase returns `email_not_confirmed`.
- Signup form: surfaces verbatim Supabase errors (covers "Database error saving new user", "Email signups disabled", etc.) so the team can debug fast.
- Auth callback: handles both PKCE `code` and `token_hash`/`type` flows. Custom email templates can point at `/auth/confirm` to wait for a human click — protects against email scanners burning one-time links.
- Server-side helper: [`lib/supabase/server.ts`](../frontend/lib/supabase/server.ts) — call from any RSC.
- Browser helper: [`lib/supabase/client.ts`](../frontend/lib/supabase/client.ts) — call from any "use client" component.

## What's missing 🔴

- **Per-user data isolation.** Every backend in-memory dict is global. Anyone signed in sees everything.
- The FastAPI backend doesn't validate Supabase JWTs at all. The frontend uses cookies; the backend just trusts whoever calls it.
- No "delete account" / "export my data" flows.
- No OAuth providers (Google/GitHub) wired — the form layout has room for them; just call `supabase.auth.signInWithOAuth({...})` after enabling in Supabase dashboard.

## Auth flow today

See [architecture.md §2](architecture.md#2-auth-flow-supabase-cookie-based) for the diagram.

## Plan: pass JWT to the backend

The cleanest pattern with `@supabase/ssr`:

1. In every frontend call to the backend, attach the access token from the current session:
   ```ts
   // lib/canvasai-api.ts
   const { data: { session } } = await createClient().auth.getSession();
   headers.Authorization = `Bearer ${session?.access_token}`;
   ```
2. Add a FastAPI dependency that verifies the JWT against Supabase's JWKS and returns the user id:
   ```python
   # backend/src/canvasai/api/deps.py
   from fastapi import Depends, Header, HTTPException
   import jwt
   from canvasai.config import get_settings

   async def current_user_id(authorization: str = Header(None)) -> str:
       if not authorization or not authorization.startswith("Bearer "):
           raise HTTPException(401, "missing token")
       token = authorization.removeprefix("Bearer ")
       try:
           payload = jwt.decode(
               token,
               get_settings().supabase_jwt_secret,  # add this to Settings
               algorithms=["HS256"],
               audience="authenticated",
           )
       except jwt.PyJWTError as e:
           raise HTTPException(401, f"invalid token: {e}")
       return payload["sub"]  # user uuid
   ```
3. Add `user_id: str = Depends(current_user_id)` to every protected route.
4. Once the SQL tables exist (per the per-feature DB plans), replace in-memory dict access with Supabase queries that filter on `user_id`. The DB also enforces this via RLS, so a bug in app code can't leak across users.

## Plan: enable RLS for every feature

Each `feature-*.md` doc lists the table + RLS policies for that domain. Apply them all when persistence lands. Without RLS, even a service-role-key backend can be tricked into reading the wrong user's data if a route handler forgets a `where user_id = $1`.

## TODO checklist

- [ ] Add `SUPABASE_JWT_SECRET` to `Settings` and `.env.example`.
- [ ] Add `api/deps.py:current_user_id` and add `Depends(current_user_id)` to every protected route.
- [ ] Make `lib/canvasai-api.ts:request()` attach the access token from the current session.
- [ ] Apply all `feature-*.md` DB schemas with RLS enabled.
- [ ] Implement an account dropdown in the topbar with "Log out" + "Account" + (later) "Delete account".
- [ ] (Optional) Wire OAuth: enable provider in Supabase, add `<Button>` in the login/signup forms calling `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '<origin>/auth/callback' } })`.
