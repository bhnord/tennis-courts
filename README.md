# Tennis Courts — Boston & NorthEast

Interactive, filterable map of 328 tennis locations around Boston and the Northeast,
parsed from the saved page `source/www.TennisNorthEast.com _ Boston Tennis Courts.html`.

## What it does

- Shows every location on a map and in a searchable list.
- **Filters (AND logic)**: minimum number of courts (slider) + attribute chips
  (Lighted, Tennis Club, Tennis Store, Racquet Stringer, Restricted, Fee, Practice Wall,
  In Construction).
- **Area filter**: right-click and drag on the map to freehand-draw a shape; only
  locations inside it are shown. Press `Esc` to cancel, use the sidebar link to clear.
- **Selection**: click a list item to fly to its marker, open its popup, and highlight
  it. Addresses link out to Google Maps.
- **Shareable links**: every filter, the drawn area, selected location, and map view are
  written to the URL, so a link reproduces the exact view.
- **Legend**: courts, clubs, stores, racquet stringers (square), and lighted locations
  (amber ring) are color-coded on the map.

## Running the page

Open `index.html` in a browser — no server, no build step required, because the dataset
is inlined into the page.

Or serve it:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Rebuilding

`index.html` is generated from `shell.html` + `data/courts.json` by `build.py`.

```bash
python3 build.py
```

Regenerate the dataset from the original saved page:

```bash
python3 parse_courts.py   # reads source/*.html, writes data/courts.json
python3 build.py          # regenerates index.html
```

## File layout

| Path | Purpose |
|---|---|
| `index.html` | Built page — what you open or serve |
| `shell.html` | HTML/CSS template used by the build |
| `app.js` | Vue app + Leaflet logic |
| `build.py` | Inlines `data/courts.json` into `index.html` |
| `data/courts.json` | Parsed dataset (328 locations) |
| `parse_courts.py` | Regenerates the dataset from the saved HTML |
| `source/` | Original TennisNorthEast saved page (parser input) |

## Stack

- Vue 3 (global build, no compile step) for the filter/list UI and URL state.
- Leaflet + OpenStreetMap tiles for the map.

Data fields per location: `slug, name, address, lat, lng, type, numCourts, matches,
lighted, club, store, stringer, restricted, fee, wall, construction`.