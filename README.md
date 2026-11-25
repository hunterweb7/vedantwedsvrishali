# vedantwedsvrishali

Invitation websites for Vedant & Vrishali, groom's side. One repository builds two sites, each in English and Marathi.

| Site | English | Marathi |
|---|---|---|
| Wedding + Reception | `/en/` | `/ma/` |
| Reception only | `/rec/en/` | `/rec/ma/` |

The root addresses `/` and `/rec/` open the last language the visitor chose, or the browser's language.
The bride's side site lives in its own repository (`vrishaliwedsvedant`).

## Edit and build

1. Edit `src/template.html` (English text, layout, styles).
2. Marathi text and the reception-only wording live in `build.mjs` (`MR` = Marathi, `REC` = reception-only changes).
   Every pair must match the template exactly, otherwise the build stops and lists what is missing.
3. Run `node build.mjs`. It writes the finished sites into `dist/`.
4. Preview with `node _tools/serve.mjs dist 8092` (local only, not in git) and open http://127.0.0.1:8092/.

Blocks marked with `@w` comments in the template are wedding-only; the reception-only pages drop them.
The photo album is switched off (`ALBUM = false` in `build.mjs`).

## Deploy on Cloudflare Pages

Workers & Pages → Create → Pages → Connect to Git → pick this repository, then:

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `node build.mjs` |
| Build output directory | `dist` |

Every push to `main` redeploys. Link previews use `https://vedantwedsvrishali.pages.dev` by default; for a custom
domain add the environment variable `SITE_URL` (Settings → Variables and Secrets) and redeploy.

Maps links for the Directions buttons: `CONFIG.MAPS_URL` (wedding hall) and `CONFIG.MAPS_URL2` (reception venue) near the
bottom of `src/template.html`; the reception-only pages use the reception link for both.
