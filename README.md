# Artist EPK (One Page)

Fast static EPK built with **HTML5 + Tailwind CDN + Vanilla JS**.

## 1) Connect your Google Sheet (Live Stats)

### Publish to web → CSV
1. In Google Sheets: **File → Share → Publish to web**
2. Choose the sheet/tab that contains the stats
3. Choose format: **Comma-separated values (.csv)**
4. Copy the generated URL (it will look like `https://docs.google.com/spreadsheets/d/e/.../pub?output=csv`)

### Paste the URL
- Open `app.js`
- Replace:
  - `CONFIG.SHEET_CSV_URL = "PASTE_YOUR_PUBLISHED_CSV_URL_HERE"`

### Required column mapping
- Column A: Platform Name
- Column B: Main Stat Label
- Column C: Value/Number
- Column F: Last Updated Timestamp

The page looks for these platform names (case-insensitive) and common aliases:
- TikTok
- Instagram (IG)
- YouTube (YT)
- Facebook (FB)
- TuneCore / Total Streams

If your sheet uses different naming, update `CONFIG.PLATFORM_ALIASES`.

## 2) Customize the EPK content

- Hero image: replace `assets/hero.svg` with your press image (keep filename or update `index.html`).
- Artist name & bio: edit `index.html` header + Bio section.
- Spotify embed: replace the `<iframe src="...">` in the Spotify section.
- YouTube embed: replace the `youtube-nocookie.com/embed/VIDEO_ID` URL.
- Bandsintown: replace `data-artist-name="ARTIST_NAME"`.

## 3) Run locally (recommended)

From this folder:

```bash
python3 -m http.server 5173
```

Then open:
- `http://localhost:5173`

(You need a local server because browsers block `fetch()` from `file://` pages.)

## 4) Deploy to Vercel (fastest)

### Option A — Vercel dashboard
1. Push this folder to a GitHub repo
2. In Vercel: **New Project → Import Git Repository**
3. Framework preset: **Other**
4. Build command: **None**
5. Output directory: **/** (root)
6. Deploy

### Add custom subdomain (epk.mydomain.com)
1. In Vercel project: **Settings → Domains → Add** `epk.mydomain.com`
2. Vercel will show the required DNS record. Usually one of:
   - **CNAME**: `epk` → `cname.vercel-dns.com`
   - or **A** record to a Vercel IP (less common for subdomains)
3. Add that DNS record at your domain registrar/DNS provider
4. Wait for DNS to propagate (minutes to a few hours)

## 5) Deploy to GitHub Pages

### Your setup (recommended)
- GitHub username: `christhrelfallm89`
- Custom domain: `epk.alyris.uk` (IONOS DNS)

### Option A — Pages from root (simple)
1. Push this folder to a GitHub repo
2. Repo → **Settings → Pages**
3. Build and deployment:
   - Source: **Deploy from a branch**
   - Branch: **main** (or master)
   - Folder: **/** (root)
4. Save

After this, your temporary URL will be:
- `https://christhrelfallm89.github.io/<repo-name>/`

### Custom subdomain
1. Repo → **Settings → Pages → Custom domain**: enter `epk.alyris.uk`
2. GitHub may create a `CNAME` file automatically. If not, create a file named `CNAME` with:

```txt
epk.alyris.uk
```

3. In IONOS DNS for `alyris.uk`, add this record:
   - Type: **CNAME**
   - Host/Name: `epk`
   - Target/Value: `christhrelfallm89.github.io`
   - TTL: default (e.g. 1 hour) is fine

4. Back in GitHub Pages, wait for the “DNS check” to succeed, then enable:
   - **Enforce HTTPS**

Notes:
- If you want HTTPS, enable **Enforce HTTPS** in GitHub Pages once DNS is set.
- For apex domains (mydomain.com), GitHub requires A/AAAA records, but for subdomains CNAME is best.

IONOS tip:
- DNS propagation can take a few minutes up to a couple of hours; if GitHub says the domain is “Not verified” right away, wait and try again.

## Troubleshooting

- If stats won’t load:
  - Confirm the sheet is published to web as **CSV**
  - Try opening the CSV URL in a browser; it should download/show CSV text
  - Ensure there are values in columns A/B/C and a timestamp in column F

- If you see CORS errors:
  - Re-publish the sheet, or ensure you used the `pub?output=csv` link

