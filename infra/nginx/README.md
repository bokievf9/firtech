# nginx for firtech.pro

- `firtech-proxy.conf` is the shared proxy snippet (includes the 32k proxy buffers the cabinet callback needs).
- `firtech.conf` is the site (zones `firtech_api` for `/api/lead`, `/api/audit`, `/agent/`; `firtech_login` 10 r/min for
  `/api/admin/login`; `firtech_chat` for `/api/chat` and `/api/demo-agent/`; `firtech_csp`; `firtech_admin` for the rest of
  `/api/admin/`; `large_client_header_buffers`). Since 2026-11-23 the snippet sets `X-Forwarded-For $remote_addr` and
  `X-Forwarded-Host $host` (security review P1-2, P2-12, P2-15); step-by-step apply in `docs/security-2026-11-23.md`.

After any change copy both to the server: the snippet to `/etc/nginx/snippets/firtech-proxy.conf` and the
site to `/etc/nginx/sites-available/firtech` (Certbot's 443 block lives in that file: merge, do not overwrite
it blindly), then `nginx -t && systemctl reload nginx`. Without the buffers a Google sign-in answers 502.
