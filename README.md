# Jimmy · Portfolio

Personal portfolio site of Jimmy, an indie game developer working with Unity and C#.

Live at: [jimmyy-67.github.io](https://jimmyy-67.github.io/)

Static site (HTML, CSS, vanilla JS) hosted on GitHub Pages.

## Content

Everything editable lives in `manifest.js`:

| Global | Used by |
| --- | --- |
| `window.ABOUT` | About view (Markdown) |
| `window.WORKS` | Projects view |
| `window.MODS` | Mods view (add `"hidden": true` to hide one card) |
| `window.GALLERY` | Portfolio galleries |
| `window.NEXUS.profile` | Nexus username, for the profile link and the stats script |

## Nexus Mods data

The numbers in the **Mods** view are not hard-coded. A GitHub Action refreshes
them daily from the official Nexus APIs and commits `stats.json`, which the page
fetches on load:

```
manifest.js ──▶ scripts/fetch-nexus-stats.mjs ──▶ stats.json ──▶ index.html
               (GitHub Actions, daily cron)       (committed)   (fetch on load)
```

If `stats.json` is missing or the fetch fails, the page falls back to the
`stats` values baked into `manifest.js`, so it never renders empty.

### Which API, and why

Nexus exposes several APIs; they are not interchangeable. This project uses the
two that carry the data the site needs:

| API | Status | Auth | What it gives us | Used for |
| --- | --- | --- | --- | --- |
| **REST v1**<br>`api.nexusmods.com/v1` | **Stable** and supported | `apikey` header | `mod_unique_downloads`, `mod_downloads`, `endorsement_count`, `version`, `updated_time` - the only supported source for **unique downloads per mod** | Per-mod cards |
| **GraphQL v2**<br>`api.nexusmods.com/v2/graphql` | **WIP**, "may change, evolve, or even disappear without warning" | none for most queries | `views`, `uniqueModDownloads`, `kudos`, `modCount`, `recognizedAuthor`, `joined`, `lastActive` - the only place where **profile views** exist at all | Profile strip + progress bar |
| REST v3<br>`api.nexusmods.com/v3` | Mostly **Experimental** | API key or Bearer JWT | Author workflows: upload mod/files, collections, version dependencies | *Not used* |
| Users/SSO<br>`users.nexusmods.com` | Stable | OAuth | Acting on behalf of a logged-in user | *Not used* |

Why not v3? Its mod endpoints are marked *Experimental* and Nexus explicitly
says Experimental means "may change significantly or be removed. Not recommended
for production" - and nothing there provides per-mod download counts that v1
does not already give. Why not v2 alone? GraphQL has `downloads` (total) and
`endorsements` per mod, but **not** unique downloads per mod (only per file,
which cannot be summed: a user downloading two files counts once per mod). So:
v1 for the mods, v2 for the profile.

Practical notes:

- **Profile views only exist in the v2 GraphQL API.** Neither v1 nor v3 exposes
  them, so if the v2 part ever breaks, the views figure stops updating (the page
  says so instead of showing a stale number as if it were fresh).
- **v2 is best-effort by design:** if the query fails (schema change, downtime),
  the script keeps the last known profile numbers, flags `profile.ok = false`,
  emits a `::warning::` in the workflow log and still exits 0 - the v1 data is
  always written first.
- **Rate limits:** v1 allows 2,500 requests / 24 h (this workflow uses 2 per
  day). v2 goes through a separate, undocumented quota.
- The API key is never exposed to visitors: the browser only reads the generated
  `stats.json`.

### One-time setup

1. Generate a personal API key: <https://www.nexusmods.com/users/myaccount?tab=api>
2. Add it as a repository secret named **`NEXUS_API_KEY`** in
   *Settings → Secrets and variables → Actions → New repository secret*.
3. Run the workflow once from the *Actions* tab (*Update Nexus Mods stats* →
   *Run workflow*) to create the first real `stats.json`.

Scheduled workflows only run on the default branch, so the daily cron starts
working once this lands on `main`.

### Script options

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXUS_API_KEY` | - | Required. Personal API key. |
| `NEXUS_API_BASE` | `https://api.nexusmods.com/v1` | REST base URL (used by the tests). |
| `NEXUS_GRAPHQL_URL` | `https://api.nexusmods.com/v2/graphql` | GraphQL endpoint. |
| `NEXUS_ENABLE_GRAPHQL` | `true` | Set to `false` to skip the profile block entirely. |
| `NEXUS_APP_NAME` | `jimmyy-67-portfolio` | Sent as `Application-Name` (see below). |
| `NEXUS_APP_VERSION` | `1.0.0` | Sent as `Application-Version` (see below). |

## Compliance with the API Acceptable Use Policy

The [API Acceptable Use Policy](https://help.nexusmods.com/article/114-api-acceptable-use-policy)
(AUP) governs every use of the API. How this project lines up with it:

| AUP rule | This project |
| --- | --- |
| Identify your application via `Application-Name` and `Application-Version` headers | ✅ Sent on every request, including GraphQL (blank/impersonated metadata is listed as unacceptable usage) |
| "We tolerate the use of your personal API key with applications that are... intended for personal use only" | ✅ Personal use: one owner, his own mods, his own site, 2 requests/day |
| No "fetching data en-masse with the intent to rehost" (scraping) | ✅ Two mods, read once a day, no redistribution of catalogue data |
| No "storing user API keys on your own server and/or using them without the action being initiated by the user" | ✅ A single first-party key in GitHub Secrets; no third-party user keys |
| Open source is "strongly encouraged" | ✅ The whole consumer - script, workflow and site - is in this public repo |
| Registration required for *public-facing* applications | ⚠️ See the note below |

> **Gray area worth knowing:** the AUP lists "using personal API keys for a
> public-facing application" as unacceptable. This is a personal stats feed for
> one author's own mods, which is not an application others use to access Nexus
> data (nobody supplies keys, nobody queries it, the daily job is the only
> consumer). If that reading ever changes, the formal fix is a short email to
> <support@nexusmods.com> describing the project - they ask for a testing build,
> a name, a description and a logo, and they issue a registered key plus an SSO
> slug. The code needs no changes for that: only the key and the app name.


Local run: `NEXUS_API_KEY=xxxx node scripts/fetch-nexus-stats.mjs`

### Field notes

- `complete` / `syncedAt` - `syncedAt` only advances when **every** mod was read
  successfully, so the page never advertises a partial sync as complete.
- `profile.ok` - whether the profile block is fresh from the v2 API.
- `recognizedAuthor` - drives the "N / 1,000 unique downloads" progress bar
  (the threshold Nexus publishes for the *Recognised Mod Author* badge). Change
  `RECOGNISED_AUTHOR_DOWNLOADS` in `index.html` if that ever changes.
