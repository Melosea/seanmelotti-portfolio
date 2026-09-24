# Future Work — post-launch backlog

## Studio web access (noted 2026-09-24)
Today the Caption Studio is a PC-only local app: it runs on Sean's desktop,
reads/writes files in this repo, and is not reachable from a phone or another machine.

**Sean's decision:** acceptable for launch; wants web access eventually.

Rough shape of the eventual work:
- Host the Studio behind auth (it writes to the repo — cannot be public)
- Replace direct filesystem writes with an API layer
- Photo upload from device (currently a local file-picker)
- Commit/push from the web app, or write to object storage + a build hook

Not a launch blocker. Revisit after the site is live and the first project ships.

## Other deferred items
- Social media links: intentionally off (see src/consts.ts). Turn on when accounts exist.
- Google Drive as a photo source in the Studio (currently local disk only).
