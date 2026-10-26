# My Playlist Studio

A local web app that turns Spotify listening-history exports into playlists. Built with vanilla JavaScript, HTML, CSS, and a small Node.js server, with no runtime dependencies.

## Run

Install Node.js 22 or newer, then run:

```sh
npm start
```

Open http://127.0.0.1:8791. On Windows, you can also double-click `Start Playlist Studio.cmd`.

Click **Try sample music** to explore with fictional data. Import Spotify history JSON files or a ZIP export to use your own music.

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
5. Click **Save private playlist to Spotify**.

Never put a Client Secret in this app. Spotify development-mode eligibility and account restrictions apply; see the [official migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide).

## How selection works

A substantial listen lasts at least 30 seconds and is not marked skipped. The engine groups tracks by normalized artist and title. Favorites use logarithmic listening frequency with a skip penalty. Recent favorites use exponential recency weighting; rediscovery boosts older substantial listens. Recency is relative to the latest play in the imported export, rather than today's date. Shuffle samples eligible songs. Genre labels are supplied by the user; this app does not infer mood or fetch genre metadata.

## Privacy and security

History files are processed in the browser and are not uploaded. Spotify receives selected song/artist searches and track IDs when saving, plus the ordinary OAuth/API requests needed to connect. The public Client ID is stored in localStorage. Tokens and the selected playlist are in tab sessionStorage; imported full history remains in memory. Disconnect clears connection and retry data. Clear everything clears imported music and labels, but does not disconnect Spotify.

The server binds only to 127.0.0.1, validates the Host header, serves an explicit file allowlist, and sends a Content Security Policy. ZIP entries have declared and actual size checks. CSV exports escape formula-like cells. Do not commit your personal Spotify export, tokens, or generated playlists.

## Tests

```sh
npm test
```

Tests use fictional records and mocked OAuth requests. Live Spotify sign-in and saving have not been verified during this review; they require an eligible developer app and interactive authorization.

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
| `test/` | Node.js regression tests |
