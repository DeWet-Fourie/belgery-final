# Google Sheet setup

Use `products-sheet-template.csv` as the header structure for the published Google Sheet.

Important collection-editable fields:

- `collection` — groups products into the rail
- `collectionTagline` — short label shown above the collection name
- `collectionDescription` — editable collection story paragraph
- `collectionCover` — one fallback image used for both the rail card and story image
- `collectionRailImage` — optional separate image just for the horizontal collection rail card
- `collectionStoryImage` — optional separate image just for the collection description/story block

Fill the collection fields once on any product row inside that collection. The website will read it and apply it to the full collection.

Best workflow: upload images to Cloudinary, copy the image URL, and paste it into the relevant Google Sheet column. Product images still use `image1`, `image2`, `gallery`, etc. Collection images are now separate from product photos.
