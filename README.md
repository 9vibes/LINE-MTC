# LINE MTC

Shared aircraft running log for an Umbrel server, a browser operator, and multiple Even Realities G2 phone companions. The glasses UI remains **Super Platano Log**. Source lives in `GitRepos (Umbrel)/LINE-MTC`.

## Install on Umbrel

Add or refresh the [KUNAS store](https://github.com/9vibes/KNS-Umbrel), then install **LINE MTC**. Supports Linux amd64 and arm64; no GPU required.

Open the app on port **28110**. Sign in as **operator** using the password shown by Umbrel. Open **Team accounts** to create individual editor accounts. Every editor can add aircraft, edit logs, change statuses, import/export, and remove entries. Operator accounts also manage team access. Optional viewer accounts are read-only.

The initial operator password is copied into a salted password hash on first startup; changing the bootstrap environment later does not reset an existing account. SQLite, sessions and audit history persist in the app's `data` directory. Do not delete that directory when updating.


The connector must be able to reach Umbrel at that address. Use the Umbrel LAN address from the connector, not `localhost` inside an unrelated container. Cloudflare provides HTTPS publicly; the connector reaches Umbrel using HTTP. No router port forwarding is required. Do not enable a cache-everything rule for this hostname; `/api/*` and HTML must bypass caching. Streaming updates send a heartbeat every 15 seconds and phones also refresh every 10 seconds as a fallback.



## Editing and synchronization

- New logs default to `--`. Status choices: `--`, `PEND`, `C/W`, `DEF`, `SUPP`.
- ETA uses 24-hour `HH:MM`; unknown times sort last.
- Each aircraft can have multiple discrepancy logs; the glasses show six log rows per page.
- LOG TIME OFF PLANE records the server's current off-plane time in `TZ` (default `America/New_York`). Status selections preserve the recorded time.
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


Server 1.0.8 changes the website’s DEF status tag from purple to red.

Server 1.0.9 removes the Add demo aircraft button from the operator website.

Version 1.0.11 opens on the current local calendar date, returns to it when the app resumes, and rolls the view over at midnight. Older entries are retained and can be viewed with Shift date. An editor already open during rollover keeps its original shift date when saved.

Companion 1.0.13 separates the selected log’s status and discrepancy with a vertical bar, for example `C/W | LT sun visor clip broken`.

## Server 1.0.16: daily Excel report

In the operator website, the aircraft editor has a Log type dropdown (NEF, MEL, OPEN) beside each log number, saved with the aircraft. Daily rows show log number | type, with MEL/OPEN red and NEF yellow. Health points remain editable beside the action/status selector and save when leaving the field. Points support negative and decimal values; clearing an input leaves it blank. These fields do not change off-plane times. Older companion edits preserve report metadata.

Print Report, next to Add aircraft, downloads `LINE-MTC-report-YYYY-MM-DD.xlsx` for the selected shift date, including all logs regardless of search or status filters. Open the workbook in Excel or another compatible spreadsheet application to print. It uses a navy date band, red headers, seven bordered columns, a minimum of 20 entry rows, wrapped descriptions, and landscape printing with repeated headers. Long reports continue onto additional pages. The Comments Def Reason column is blank for manual notes in the workbook. Existing records without type or points remain blank; the export does not infer them.

Deploy the rebuilt server to make this feature available on the live website. No database migration is needed: optional metadata is stored in the existing log JSON. View-only accounts may download reports but cannot change report fields.

## Version 1.0.17

The server aircraft cards show ETD beside ETA, and the editor places Departure time below Arrival time. ETD accepts 24-hour time, remains optional, and is preserved when older phone clients save aircraft. The server editor no longer offers off-plane time or log status controls; saved values are preserved, and aircraft-card status controls remain available.

The installed companion removes Clear this day's aircraft and the SHARED header suffix, displays the banana and SUPER PLATANO A/C ROUTING branding, and uses SUPER PLATANO A/C as the Even Hub app-list name to fit its 20-character limit. Off-plane time remains available in the phone editor.

## Server 1.0.18 / companion 1.0.21

On narrow phone screens, the server keeps ETA, ETD and Gate beside the aircraft number without horizontal scrolling. The companion supports ETD editing and shows read-only log type beside the log number, separated by a vertical bar. MEL and OPEN are red; NEF is yellow. Its log rows no longer reserve the former log-type row. Shared-client tests run serially because they use one shared server database.

## Server 1.0.20 / companion 1.0.35

Glasses use measured G2 font widths for scrolling discrepancies and show six log rows, a small blinking continuation arrow behind aircraft text, and both clock formats. The selected aircraft view shows ETD, a centered T- interval calculated as ETD minus ETA (including overnight turns), and off-plane time on the right. Log type appears beside the log number. LOG TIME OFF PLANE replaces the unset-status menu action; C/W, DEF and SUPP no longer record off-plane time. Update the server and companion together for this behavior. Existing data is preserved.

## Server 1.0.21 / companion 1.0.37

LOG TIME OFF PLANE records time and sets every log on that aircraft to PEND. Status changes preserve recorded time even for legacy clients that omit the action marker. The phone checks server compatibility before status actions and shows blocked saves on both the phone and glasses. Install both updates; the store publication alone does not upgrade the running Umbrel app.
