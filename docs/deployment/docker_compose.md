# VPS Docker Compose deployment

This Compose target builds the Forum SPA as a static image. It is intended for the test VPS and keeps the container reachable only through the VPS loopback interface.

## Build inputs

- Build image: `node:24.11.1-alpine3.22`
- Package manager: `pnpm 9.15.9`
- Runtime image: `nginx:1.28.0-alpine3.22`
- The dependency lockfile is installed with `--frozen-lockfile`.
- Vite builds in `test` mode. The Docker context excludes `.env*`, `.git`, `node_modules`, and local build output, so developer or production env files are not baked into the image.

Compose supplies same-origin API paths (`/v1`, `/v2`), enables Works V2, and disables mock/devtools flags. `VITE_BACKEND_URL` selects the test Forum origin used by the login redirect. These are public build-time values; never pass credentials as Vite variables because Vite embeds them in browser assets.

## Build and run

From the repository root, with Docker Compose v2 and BuildKit available:

```sh
docker compose config
docker compose build --pull
docker compose up -d --no-build
docker compose ps
```

The default image tag is `odysseia-forum-webpage:2.3.13-test`. The only published port is `127.0.0.1:8081` on the VPS. Change `WEB_PORT` only if that loopback port is already occupied. Set `VITE_BACKEND_URL` at build time if the test Forum origin differs; rebuild after changing it. The container runs as UID/GID 101, drops Linux capabilities, has a read-only root filesystem, and writes only to `/tmp` tmpfs.

Check the service locally on the VPS:

```sh
curl --fail --silent --show-error http://127.0.0.1:8081/healthz
curl --fail --silent --show-error http://127.0.0.1:8081/booklists/example
```

The first request returns HTTP 204. The second returns the SPA shell, allowing React Router deep links to work.

## Existing Forum API and host Nginx

The container serves only static files; it does not publish or proxy Forum APIs. Browser API calls use same-origin `/v1` and `/v2`. Keep the existing test VPS Nginx `/v1` and `/v2` locations routed to the existing Forum API at `127.0.0.1:10810`, and add only a general `/` location to `127.0.0.1:8081` after the API-specific locations. Do not route API paths through this static container, and do not publish the Docker port on `0.0.0.0`.

Example shape for the existing server block (merge with the live configuration; do not replace its existing API, OAuth, or security locations):

```nginx
location / {
    proxy_pass http://127.0.0.1:8081;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

The Compose file does not edit or reload host Nginx, issue certificates, configure DNS, or expose public ports. Those remain separate deployment steps.

## Cloudflare Pages Functions and share cards

Docker's Vite build copies only `dist/` into Nginx. It does not run the repository's `functions/` handlers. The dynamic Open Graph routes for `/booklists/{id}`, `/tournaments/{id}`, `/threads/{id}`, and `/u/{id}` depend on the Cloudflare Pages Functions runtime and its server-side metadata service configuration (including its server-only token). On this standalone VPS image, deep links load the SPA for browsers, but social crawlers receive the generic static `index.html` metadata rather than per-item share cards. Do not copy the Pages secret into Vite or this image. Keeping dynamic share cards requires a separate Pages/Workers runtime for those routes or a deliberate port of the handlers to a server-side service; that is outside this Compose target.
