# Known issues with some retailers

### Nordiskarum

- The category breadcrums on a product page only point to the homepage, not the actual category of the product. See [this](https://www.nordiskarum.se/mexico-matbord-o140-svart-alu-teak.html) for example.
  Therefore it's quite difficult/require custom logic to map products with categories.
  Currently no solution yet.

### K-rauta

- Not all products belong to a leaf category. Some belong to 2nd-to-last category.

### Bygghemma

- Multiple categories per product.
- Does not show original price despite being on campaign.
- Product variants with product groups. For example [here](https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-estelle-140-med-4-valentina-stolar-sammet/p-1117252). We are doing a hacky solution now. (TODO: Toan write about this)

### Ebuy24

- The number of products per category changes frequently (hourly even). It's likely because they only show in-stock products.
