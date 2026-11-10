## Playlist Studio 1.0.20

- Removed the unnecessary contents lookup before first populating a newly created YouTube playlist.
- Added bounded retries for explicit playlistNotFound responses when reading or adding playlist items.
- Preserved reconciliation after successful or uncertain writes so retrying does not blindly duplicate songs.
- Missing playlists are never automatically replaced; quota and ambiguous network errors are not automatically retried.

Validation: all 87 automated tests pass, including six new checks for missing playlists, interrupted saves, bounded retries, and quota errors. Live YouTube playlist creation remains unverified.
