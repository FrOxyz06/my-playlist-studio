## Playlist Studio 1.0.18

- Fixed a main-process crash during Google/YouTube sign-in when late browser requests reached a closed callback server.
- Late and duplicate callbacks now receive a safe response without exchanging the authorization code again.
- Preserved callback host, path, and state validation.

Validation: all 81 automated tests pass, including regression checks for late requests after successful and denied sign-in. Live Google authorization has not been verified in this session.
