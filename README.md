# BELGERY one-page collection rail

Replace your current repo files with these files:
- index.html
- products.html
- collections.html
- custom-orders.html
- script.js
- style.css
- assets/
- data/

## Google Sheet columns for editable collections

Collections are generated from the `collection` column. To edit each collection's story from Google Sheets, add these optional columns to the same products sheet:

- `collectionTagline` — small text above the collection name
- `collectionDescription` — the paragraph shown inside the collection story block
- `collectionCover` — image used for the collection rail card and story image

You only need to fill these once per collection. If multiple products in the same collection contain these fields, the website uses the filled values it finds.

Example:

| name | collection | collectionTagline | collectionDescription | collectionCover |
|---|---|---|---|---|
| Laptop Bag | Office | Curated BELGERY office pieces | Clean handmade leather pieces for workdays, gifting and everyday carry. | https://.../office-cover.png |

The rest of the product columns still work as before.
