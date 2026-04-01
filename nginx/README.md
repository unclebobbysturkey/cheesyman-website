# nginx (prod)

Nginx configuration for the production Docker deployment of cheesyman.com.

## Files

| File | Description |
|---|---|
| `nginx_docker.conf` | Active production config — redirects HTTP to HTTPS, terminates SSL, serves static HTML, and reverse-proxies API routes to Node.js containers with 5-minute response caching |
| `new_config` | Alternate config (not currently active) |
| `main_config_test` | Reference config for local testing |

## Proxy Routes (`nginx_docker.conf`)

| Location | Proxies To | Container Port |
|---|---|---|
| `/cfb_api/` | `cfb_main_app` | 3001 |
| `/matchup_api/` | `cfb_matchup_app` | 3002 |
| `/cbb_api/` | `cbb_main_app` | 3003 |
| `/raceschedule/` | `race_schedule_app` | 3004 |
| `/` | Static HTML (`/usr/share/nginx/html`) | — |

## SSL

Certificates are managed by Let's Encrypt and mounted read-only from `/etc/letsencrypt` on the host. Renew with `certbot renew` on the host server.
