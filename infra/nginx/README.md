# nginx for firtech.pro

- `firtech-proxy.conf` is the shared proxy snippet (includes the 32k proxy buffers the cabinet callback needs).
- `firtech.conf` is the site (zones `firtech_api` for `/api/lead`, `firtech_admin` for `/api/admin/`, `large_client_header_buffers`).

After any change copy both to the server: the snippet to `/etc/nginx/snippets/firtech-proxy.conf` and the
site to `/etc/nginx/sites-available/firtech` (Certbot's 443 block lives in that file: merge, do not overwrite
it blindly), then `nginx -t && systemctl reload nginx`. Without the buffers a Google sign-in answers 502.
