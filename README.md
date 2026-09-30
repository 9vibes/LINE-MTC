# LINE MTC

Shared aircraft running log for an Umbrel server, a browser operator, and multiple Even Realities G2 phone companions. The glasses UI remains **Super Platano Log**. Source lives in `GitRepos (Umbrel)/LINE-MTC`.

## Install on Umbrel

Add or refresh the [KUNAS store](https://github.com/9vibes/KNS-Umbrel), then install **LINE MTC**. Supports Linux amd64 and arm64; no GPU required.

Open the app on port **28110**. Sign in as **operator** using the password shown by Umbrel. Open **Team accounts** to create individual editor accounts. Every editor can add aircraft, edit logs, change statuses, import/export, and remove entries. Operator accounts also manage team access. Optional viewer accounts are read-only.

The initial operator password is copied into a salted password hash on first startup; changing the bootstrap environment later does not reset an existing account. SQLite, sessions and audit history persist in the app's `data` directory. Do not delete that directory when updating.

## Cloudflare Tunnel: mtc.kunas.pro

In your existing Cloudflare Tunnel, add a **published application route**:

| Setting | Value |
| --- | --- |
| Hostname | `mtc.kunas.pro` |
| Service type | HTTP |
| Service URL | `10.12.12.12:28110` |

The connector must be able to reach Umbrel at that address. Use the Umbrel LAN address from the connector, not `localhost` inside an unrelated container. Cloudflare provides HTTPS publicly; the connector reaches Umbrel using HTTP. No router port forwarding is required. Do not enable a cache-everything rule for this hostname; `/api/*` and HTML must bypass caching. Streaming updates send a heartbeat every 15 seconds and phones also refresh every 10 seconds as a fallback.

The shipped Umbrel configuration accepts `https://mtc.kunas.pro`, `http://umbrel.local:28110`, `http://10.12.12.12:28110`, and the Umbrel device hostname. If you use another local hostname/address, add its exact origin to `ALLOWED_ORIGINS` and restart the app. `PUBLIC_ORIGIN` must remain `https://mtc.kunas.pro` for this domain. Native app authentication protects both the operator UI and shared data.

For an existing installation configured with the former `rl.kunas.pro` address, change the LINE MTC app environment variable `PUBLIC_ORIGIN` to `https://mtc.kunas.pro` and restart the app. Updating the store alone does not override a saved environment value. An `Unrecognized request origin` response during sign-in means the running server has not accepted the new origin yet.

After configuring the route, check `https://mtc.kunas.pro/api/health` and then sign in at `https://mtc.kunas.pro/`.

## Phones and glasses

Generate a QR with the official Even CLI:

```sh
npx evenhub qr --url https://mtc.kunas.pro/companion
```

Scan it using Even Realities **Prototype Mode**, then sign in with the team member's account. The remote companion runs directly at the server origin, so its authenticated real-time connection works without third-party cookies. Each phone connects to its own paired G2. The browser operator can use `https://mtc.kunas.pro/operator`.

### Installable Even Hub app (1.0.9)

Update LINE MTC on Umbrel to **1.0.2 or later** before using the packaged companion. Build it with `npm run pack`; the output is `line-mtc-1.0.9.ehpk`. Upload it to your project’s **Private builds** in the [Even Hub developer portal](https://evenhub.evenrealities.com), then install it through Even Realities → Even Hub → Me → Apps → Private builds. Private builds are account-only; use the portal’s Beta Testing flow to distribute to teammates. Minimum Even Realities app version: **2.2.10**.

The 1.0.9 packaged app removes demo aircraft controls, colors C/W green, DEF red, SUPP blue and PEND orange, and disables pinch/double-tap zoom and prevents input-focus zoom in the phone interface while retaining scrolling. It works with server 1.0.2; no server update is required.

The packaged app retains the Super Platano Log interface and connects to **https://mtc.kunas.pro**. Sign in with an existing LINE MTC account; no password is bundled. It uses a revocable seven-day bearer session stored through Even’s native local-storage bridge with WebView storage as a fallback, cross-origin live events, and polling fallback. Sign out to revoke the session. The website continues using HttpOnly cookies. Dedicated `/api/mobile/*` endpoints never accept cookies and expose CORS only for explicit bearer authentication; browser routes retain their origin checks. Team roles, conflicts, and off-plane timestamps are enforced by the same server.

`npm run build` remains the website/static-preview build. `npm run build:companion` produces the server-connected installable app in `dist-companion/`; it never falls back to local demo data. If the server is unavailable, reopen when connected. Physical G2 installation and background/locked-phone behavior must still be verified in Private/Beta Testing. See [Even’s networking rules](https://hub.evenrealities.com/docs/build/networking) and [private testing instructions](https://hub.evenrealities.com/docs/test/private-testing).

While the companion is open, edits publish immediately to every connected phone and its glasses. Phones refresh on reconnect or returning to the foreground. Mobile OS background suspension can stop the WebView; foregrounding it fetches the latest state. An offline indicator appears on the glasses when the connection is lost. Offline edits are not queued or reported as saved.

## Editing and synchronization

- New logs default to `--`. Status choices: `--`, `PEND`, `C/W`, `DEF`, `SUPP`.
- ETA uses 24-hour `HH:MM`; unknown times sort last.
- Each aircraft can have multiple discrepancy logs; the glasses show five log rows per page.
- C/W, DEF and SUPP selections stamp the server's current off-plane time in `TZ` (default `America/New_York`). PEND and `--` leave it unchanged.
- SQLite is the source of truth. All users share the same aircraft list and shift dates.
- Writes include a revision. A stale write is rejected with an explanation, and the latest shared state loads. If an edit dialog is stale, close/reopen it and reapply the change. Another user's changes are never silently overwritten.
- Shared mode never uploads local browser data or auto-seeds examples. To migrate your prototype, export its JSON backup, sign in to LINE MTC, and import it. Import replaces the whole shared dataset and requires an in-app confirmation.
- Export provides the aircraft/log dataset. Back up the Umbrel app data directory as well to preserve accounts and audit history; stop the app first or use an SQLite-aware backup so WAL data is included.

This organizer does not submit records to an airline maintenance system.

## Standalone Docker

```sh
mkdir -p secrets
# Create secrets/admin-password privately with a password of at least 16 characters.
docker compose up -d --build
```

The default standalone port binding is `127.0.0.1:28110`. Use `BIND_ADDRESS` and `ALLOWED_ORIGINS` deliberately if exposing it to a LAN connector. Persistent data is in the `line-mtc-data` named volume. Display name: **LINE MTC**; Docker identifiers use `line-mtc` / `LINE-MTC` because Docker container names cannot contain spaces.

## Development and checks

Node **22.22.3** is pinned in the image. `node:sqlite` is built in and marked experimental in this Node version. No external database service is needed.

```sh
npm ci
npm run build
npm run test:server
npm test
npm run test:shared
```

`npm run dev` starts a device-only static preview. To run shared mode locally, build the server and provide `DB_PATH`, `PUBLIC_ORIGIN`, and `LINE_MTC_ADMIN_PASSWORD_FILE`, then `npm start`. Keep a development database on a local disk, not SMB; production SQLite lives on Umbrel's local disk.

The GitHub release workflow runs browser, backend, and two-client synchronization tests before publishing amd64/arm64 images to `ghcr.io/9vibes/line-mtc`. Umbrel releases pin the resulting image digest. Do not point an app-store release at an image before its build and anonymous pull check succeed.

The Clear all aircraft button beneath the glasses preview asks for confirmation before clearing every shift date and discrepancy log for all users. Viewer accounts cannot clear data; concurrent edits reject a stale clear request.

Server 1.0.8 changes the website’s DEF status tag from purple to red.

Server 1.0.9 removes the Add demo aircraft button from the operator website.
