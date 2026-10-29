# Offline map data

`world.json` holds public-domain Natural Earth geography, built once with the builder below and checked by eye:

- **Land:** Natural Earth 4.1.0 `ne_50m_land` polygons (sea, coast and the border-free mode).
- **Countries:** Natural Earth 5.1.1 `ne_10m_admin_0_countries_pse`, the Palestine point of view: Palestine is a separate state (Gaza and the West Bank, labelled «فلسطين») and the Golan is part of Syria. That file also draws Western Sahara inside Morocco. Arabic names are the file's own `NAME_AR`; nothing was translated. Nine small features with no name in that file (Ilemi, Abyei, the Paracel Islands and a few specks) were left out, so they have no border; the land layer still covers them.
- **Places:** none. The approved `ne_10m_populated_places_simple` has no Arabic names, and the builder never invents them, so city dots come from creator-supplied coordinates.
- **Simplification:** the default 0.06-degree tolerance (about 6 km): a stylised paper map, not a survey map. Small states look angular when zoomed in.

The downloads were deleted after the build; users never download them. A route and authored city dots work without any geography. Never ship the two-square test fixture as geography.

The clean-room builder accepts GeoJSON FeatureCollections or unpacked Natural Earth `.shp` plus its matching UTF-8 `.dbf` (polygon land/countries, point places). No download, ZIP unpacker or external converter runs. Preserve the `.prj` and `.cpg` for provenance; geographic coordinates must be WGS84 longitude/latitude. Polyline coastline input is not land: use the Natural Earth **land polygons** product for a filled land/sea fallback.

```text
node scripts/build-map-data.mjs --land local/land.shp --out engine/src/maps/data/world.json
node scripts/build-map-data.mjs --land local/land.shp --countries local/verified-pov.shp --places local/places.shp --pov arab-palestine --verified-pov --provenance "Natural Earth / verified release and POV" --out engine/src/maps/data/world.json
```

The latter declaration means a human checked the actual POV. The builder additionally requires a separate Palestine state feature and Arabic names. It cannot decide a political perspective from a filename. Countries without `name_ar`/`NAME_AR` fail clearly; supply reviewed names in input, not fabricated translations. Runtime scenes can select countries/places by exact `name_ar` or use creator-supplied city coordinates. Display borders only after the manager verifies the data. The simplifier preserves ring closure and holes, rounds to four decimals and uses a configurable `--tolerance` in degrees; it is not topology preserving, so inspect islands, shared borders and disputed regions after conversion.
