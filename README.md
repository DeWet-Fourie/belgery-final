# BELGERY Sheet-Driven Catalogue Site

This is the final sheet-driven BELGERY catalogue version.

## Important

There are **no hard-coded products** in `script.js`.

Products are created only from this published Google Sheet CSV:

```text
https://docs.google.com/spreadsheets/d/e/2PACX-1vTQOWR3E1sjd7wLZDDx66hSNLB3C_bCQfJZwaCSmRNvStwGasp6Yx1ICc3mP5-z_24RmCVOm8JdKHnz/pub?gid=0&single=true&output=csv
```

## Google Sheet row 1 headings

Use these exact headings:

```text
id,name,collection,price,shortDescription,longDescription,image1,image2,image3,image4,image5,image6,image7,image8,gallery,available,featured,sortOrder,material,dimensions,leadTime,whatsappMessage
```

## Product images

Use Cloudinary Secure URLs in the image columns.

Example:

```text
https://res.cloudinary.com/dmac29ipj/image/upload/v123456/belgery/products/work-bag-1.jpg
```

The website supports:

```text
image1 = main product image
image2-image8 = product gallery images
gallery = optional extra image URLs separated by commas or |
```

## Add a product

1. Upload product photos to Cloudinary.
2. Copy each image's Secure URL.
3. Add a new row in the Google Sheet.
4. Paste the Cloudinary URLs into `image1`, `image2`, etc.
5. Set `available` to `YES`.
6. Set `featured` to `YES` if it must appear on the homepage.

## Remove/hide a product

Either delete the Sheet row, or set:

```text
available = NO
```

## Collections

Collections are generated automatically from the `collection` column.

Examples:

```text
Bags
Belts
Laptop Sleeves
Accessories
```

## Backgrounds and logo

These are loaded from Cloudinary in the code:

```text
Hero: https://res.cloudinary.com/dmac29ipj/image/upload/v1779132058/belgery_hero_ffmn86.png
Collections/products background: https://res.cloudinary.com/dmac29ipj/image/upload/v1779132514/belgery_background_leather_ej037z.png
Logo: https://res.cloudinary.com/dmac29ipj/image/upload/v1779132061/belgery_logo_nugqbd.png
Custom order background: https://res.cloudinary.com/dmac29ipj/image/upload/v1779132057/Belgery_Background_charcoal_qc7jby.png
```

## GitHub upload rule

Upload the contents of this folder to the repo root:

```text
index.html
collections.html
products.html
custom-orders.html
style.css
script.js
assets/
data/
README.md
```

Do not upload the outer folder itself.
