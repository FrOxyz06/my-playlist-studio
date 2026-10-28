# My Playlist Studio

A local web app that turns Spotify listening-history exports into playlists. Built with vanilla JavaScript, HTML, CSS, and a small Node.js server, with no runtime dependencies.

## Run

Install Node.js 22 or newer, then run:

```sh
npm start
```

Open http://127.0.0.1:8791. On Windows, you can also double-click `Start Playlist Studio.cmd`.

Click **Explore sample music** to explore with fictional data. Import Spotify history JSON files or a ZIP export to use your own music.

## Features

- Basic and extended Spotify history formats, with duplicate-record filtering.
- Artist filters and manually assigned genre labels.
- Favorites, recent favorites, rediscovery, and shuffle mixes.
- Playlist length and per-artist limits; remove individual songs.
- CSV and Spotify-link exports; genre-label import/export.
- Optional private-playlist saving with Spotify OAuth Authorization Code + PKCE.
- Matching by track URI, or exact normalized title and artist when no URI is available.
- Retry support after a partial save without appending duplicate tracks.

## Optional Spotify connection

1. Create or select your app at https://developer.spotify.com/dashboard.
2. Register `http://127.0.0.1:8791/callback` as its redirect URI.
3. Start this app locally and paste the **public Client ID** into its connection field.
4. Connect Spotify, authorize private-playlist management, and generate a playlist.
5. Click **Save to Spotify**.

Never put a Client Secret in this app. Spotify development-mode eligibility and account restrictions apply; see the [official migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide).

## How selection works

A substantial listen lasts at least 30 seconds and is not marked skipped. The engine groups tracks by normalized artist and title. Favorites use logarithmic listening frequency with a skip penalty. Recent favorites use exponential recency weighting; rediscovery boosts older substantial listens. Recency is relative to the latest play in the imported export, rather than today's date. Shuffle samples eligible songs. Genre labels are supplied by the user; this app does not infer mood or fetch genre metadata.

## Privacy and security

History files are processed in the browser and are not uploaded. Spotify receives selected song/artist searches and track IDs when saving, plus the ordinary OAuth/API requests needed to connect. The public Client ID is stored in localStorage. Tokens and the selected playlist are in tab sessionStorage; imported full history remains in memory. Disconnect clears connection and retry data. Clear collection clears imported music and labels, but does not disconnect Spotify.

The server binds only to 127.0.0.1, validates the Host header, serves an explicit file allowlist, and sends a Content Security Policy. ZIP entries have declared and actual size checks. CSV exports escape formula-like cells. Do not commit your personal Spotify export, tokens, or generated playlists.

## Tests

```sh
npm test
```

All 17 regression tests passed during the October 26, 2026 review, using fictional records and mocked OAuth requests. Browser checks verified sample playlist generation, artist and genre filters, track removal, clearing data, and live Spotify connection. The owner confirmed successful playlist saving to Spotify; that save result was reported by the owner rather than independently inspected.

## Troubleshooting

Keep the local server running throughout Spotify sign-in. If the callback reports that 127.0.0.1 refused to connect, restart the launcher and refresh the original callback tab. If the authorization session has expired, start Connect Spotify again from the app.

## Limitations

- Playlists contain music already present in the imported history, rather than discovering new artists.
- Use one export type per listening period; different export formats can report the same play differently.
- ZIP64, encrypted ZIPs, unsupported compression, and oversized history must be extracted or split first. Modern browser support for deflate-raw decompression is required for compressed ZIP imports.
- Sign-in restores the selected playlist, not the full imported history. Reimport history to generate more mixes after redirect.
- If creation times out before Spotify returns the new playlist ID, check Spotify before retrying; an empty playlist may already exist.

## Source layout

| File | Purpose |
| --- | --- |
| `playlist-engine.js` | Parsing, scoring, filtering, and exports |
| `playlist-studio.js` | UI, ZIP import, labels, and local state |
| `spotify-auth.js` | PKCE, token refresh, and API requests |
| `spotify-save.js` | Track matching and private-playlist saving |
| `studio-server.cjs` | Local HTTP server |
| `studio-polish.js` | Mix controls, track rendering, record animation, removal undo, and inline save feedback |
| `test/` | Node.js regression tests |

## Interface rebuild

The October 26 rebuild replaces the frontend with a responsive listening workspace: collection navigation, an animated CSS turntable, four mix choices, editable tracks with undo, and inline save feedback. Motion honors the system reduced-motion preference. No external fonts or image requests are needed.

Browser checks on the rebuilt interface covered 375px and 768px layouts without horizontal overflow, 12-song generation, single-artist filtering, removal and undo, native minimum-value validation, and CSV download. All 17 regression tests passed. Spotify authorization and live saving were not repeated for this visual rebuild.

## Windows desktop app

Run `npm install`, then `npm run desktop`. Build the per-user Windows installer with `npm run dist:win`. Close the standalone local server first: the desktop app owns port 8791 for Spotify callbacks.

The app keeps history and settings in its Electron user-data directory. Spotify tokens are encrypted with Windows-backed Electron safeStorage and expire 30 days after authorization; refreshing access tokens does not restart that timer. Sign-in opens in the default browser and returns to the desktop app. Browser history and sessions do not migrate automatically: import and connect once in the desktop app.

Install a newer version over the old one using the same app ID to preserve app data. Automatic updates are not enabled. Builds are currently unsigned. Last.fm credentials stay outside the installer: development startup copies the existing local configuration into the user-data directory on this PC.

Version 1.0.1 adds direct Spotify sign-in with the configured public application ID. Users enter credentials only on Spotify’s website. An advanced Client ID override remains available for other developer apps; Spotify development-mode account restrictions still apply.

Version 1.0.2 adds Last.fm settings in the sidebar. Save and check connection validates a key with Last.fm before replacing local configuration. The status endpoint reports only whether a key exists; it never returns the saved key. Cross-origin writes are rejected. The Windows menu strip is replaced by a draggable title bar with native window controls.

Version 1.0.3 displays the connected Spotify account’s name and profile image in the header, with initials when artwork is unavailable. Clicking the badge opens connection settings. No profile data is stored outside the existing Spotify session.


Version 1.0.5 unifies the desktop title bar and page header. Theme and account controls share the toolbar; native caption buttons retain their own reserved space. The caption colors follow the selected light/dark appearance.

Version 1.0.6 includes imported songs in Last.fm discovery and directly reuses their Spotify IDs when available. Empty results distinguish missing recommendations from unsuccessful Spotify matching. The unified toolbar has no separator border.

Version 1.0.7 falls back to imported listening history when Last.fm is unavailable, returns no songs, or produces no Spotify matches. Collection mixes prefer shared artist labels, listening within 30 minutes of the starting song, and substantial listens, with a soft artist variety penalty. These are listening-history signals rather than audio similarity analysis. The fallback also works without Spotify sign-in; saving still requires Spotify.


## GitHub desktop updates (1.0.8)

Install the NSIS release once to enable updates. The packaged app checks GitHub Releases eight seconds after launch. Check for updates in the sidebar checks manually. Download and restart each require confirmation; closing the app does not automatically install a deferred update. Failed checks leave the app usable. History, the encrypted Spotify session, and Last.fm settings remain in the existing user-data directory.

Release process: commit the tested source, increase package.json and package-lock.json versions together, and push a matching tag such as v1.0.8. The Windows release workflow runs tests, builds NSIS, and uploads a **draft** release to FrOxyz06/my-playlist-studio. Inspect the installer and its latest.yml and .blockmap assets, then publish the draft for installed apps to see it. A source-code push alone does not release an update. The workflow uses GitHub's scoped GITHUB_TOKEN; no publishing token is embedded in the app. The configured update feed requires publicly accessible releases for ordinary users. The first live update still needs verification between two published installed versions. Builds remain unsigned.


Version 1.0.9 restores the original sidebar layout with compact-window adjustments, cover-led suggestions, SVG theme controls, and a compact account trigger. The account dialog supports adding, switching and removing up to ten Spotify accounts. Desktop accounts are encrypted separately from the active session; browser accounts remain in sessionStorage for that tab. Switching verifies Spotify identity and requires reconnecting after thirty days. Existing imported history remains device-wide, not separate per account. Live multi-account sign-in and visual resize checks still need verification.

Release workflow: an explicit [release] commit on main, a matching version tag, or manual dispatch now builds and publishes a release after npm ci and all tests succeed. Ordinary commits do not publish. Versions must be increased before releasing.


Version 1.0.10 replaces the manual update link with a header indicator visible only when an update is available. Startup checks and six-hour checks are silent; downloading and installing still require explicit approval. Last.fm settings now loads the saved key into a password field; Show reveals it through a same-origin JSON request. Ordinary GET status responses still never include credentials.
