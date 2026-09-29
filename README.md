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

A standalone `.ehpk` does not currently include a remote pairing flow: use this HTTPS QR workflow for shared mode. Static previews still work locally and retain device-only storage. Do not distribute a static package as a shared companion.

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
