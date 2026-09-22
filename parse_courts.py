#!/usr/bin/env python3
"""Parse tennis court data from the saved TennisNorthEast.com page into data/courts.json."""
import html as H
import json
import re
import sys

HTML_PATH = "source/www.TennisNorthEast.com _ Boston Tennis Courts.html"
OUT_PATH = "data/courts.json"


def strip_tags(s):
    return H.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def main():
    with open(HTML_PATH, encoding="utf-8", errors="replace") as f:
        data = f.read()

    i = data.index("window.serverData['location_data'] = ")
    i += len("window.serverData['location_data'] = ")
    locations, end = json.JSONDecoder().raw_decode(data, i)

    li_i = data.find("location-section")
    li_j = data.find("window.serverData", li_i)
    body = data[li_i:li_j]

    def parse_li(li):
        sl = re.search(r"court_detail/([^\"']+)", li)
        name = re.search(r"court_detail/[^\"']+[\">][^>]*>([^<]+)<", li)
        addr = re.search(r"court_address[^>]*>([^<]+)<", li)
        attrs = []
        m = re.search(r'<ul class="location-matches.*?</ul>', li, re.S)
        if m:
            for it in re.split(r"<li", m.group(0))[1:]:
                t = strip_tags(it)
                if t:
                    attrs.append(t.replace("\n", " ").strip())
        return {
            "slug": sl.group(1) if sl else None,
            "name": H.unescape(name.group(1)) if name else None,
            "address": H.unescape(addr.group(1)) if addr else None,
            "attrs": attrs,
        }

    list_items = []
    for li in re.findall(r'<li class="clearfix">\s*\n(.*?)\n  </li>', body, re.S):
        p = parse_li(li)
        if p["slug"]:
            list_items.append(p)

    by_slug = {p["slug"]: p for p in list_items}

    icon_types = {
        "0c.png": "club",
        "google_map_pin.png": "court",
        "tennis_store.png": "store",
    }

    courts = []
    for loc in locations:
        inf = loc["infowindow"]
        sl = re.search(r"court_detail/([^\"']+)", inf)
        _addr = re.search(r"<strong>([^<]+)<", inf)
        _courts = re.search(r"# of Courts:</strong>\s*(\d+)", inf)
        _matches = re.search(r"# of Matches played here:</strong>\s*(\d+)", inf)
        pic = loc["picture"]["url"].split("/")[-1]

        slug = sl.group(1) if sl else ""
        li = by_slug.get(slug, {})
        attrs = li.get("attrs", [])

        def has(kw):
            return any(kw in a.lower() for a in attrs)

        courts.append(
            {
                "slug": slug,
                "name": li.get("name") or "",
                "address": li.get("address") or "",
                "lat": float(loc["lat"]),
                "lng": float(loc["lng"]),
                "type": icon_types.get(pic, "court"),
                "pic": pic,
                "numCourts": int(_courts.group(1)) if _courts else 0,
                "matches": int(_matches.group(1)) if _matches else 0,
                "lighted": has("lighted"),
                "club": has("tennis club") or pic == "0c.png",
                "store": has("store") or pic == "tennis_store.png",
                "stringer": has("racquet"),
                "restricted": has("restricted"),
                "fee": has("fee"),
                "wall": has("wall"),
                "construction": has("construction"),
            }
        )

    missing = []
    for li in list_items:
        if not any(c["slug"] == li["slug"] for c in courts):
            attrs = li["attrs"]

            def has2(kw):
                return any(kw in a.lower() for a in attrs)

            missing.append(
                {
                    "slug": li["slug"],
                    "name": li["name"],
                    "address": li["address"],
                    "lat": None,
                    "lng": None,
                    "type": "club" if has2("tennis club") else "court",
                    "pic": "none",
                    "numCourts": next(
                        (int(a.split()[0]) for a in attrs
                         if a.split()[0].isdigit() and "ourd" in a), 0),
                    "matches": 0,
                    "lighted": has2("lighted"),
                    "club": has2("tennis club"),
                    "store": has2("store"),
                    "stringer": has2("racquet"),
                    "restricted": has2("restricted"),
                    "fee": has2("fee"),
                    "wall": has2("wall"),
                    "construction": has2("construction"),
                }
            )

    merged = {}

    def merge(c):
        k = c["slug"]
        if k in merged:
            prev = merged[k]
            for field in ("lighted", "club", "store", "stringer",
                          "restricted", "fee", "wall", "construction"):
                c[field] = c[field] or prev[field]
            prev["numCourts"] = max(prev["numCourts"], c["numCourts"])
            prev["matches"] = max(prev["matches"], c["matches"])
        else:
            merged[k] = c

    for c in courts + missing:
        merge(c)

    for c in merged.values():
        c["type"] = "store" if c["store"] else "club" if c["club"] else "court"
        c.pop("pic", None)

    all_courts = sorted(merged.values(), key=lambda c: (c["name"] or "").lower())

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"count": len(all_courts), "courts": all_courts}, f, indent=2,
                  ensure_ascii=False)

    print(f"Parsed {len(all_courts)} locations -> {OUT_PATH}")


if __name__ == "__main__":
    main()