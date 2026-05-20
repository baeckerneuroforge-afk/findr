# Gong Integration Diff Notes

Before "Connect Gong" works in Vercel, set these environment variables in
Vercel Project Settings -> Environment Variables:

- `GONG_CLIENT_ID`
- `GONG_CLIENT_SECRET`
- `GONG_REDIRECT_URI`

Production redirect URI:

```text
https://project-de94w.vercel.app/api/integrations/gong/callback
```

Local redirect URI:

```text
http://localhost:3000/api/integrations/gong/callback
```

If these vars are missing, `/api/integrations/gong/connect` intentionally
returns `503` and the UI shows:

```text
Gong integration not configured. Contact administrator.
```
