# Known issues with some retailers

### Nordiskarum

- The category breadcrums on a product page only point to the homepage, not the actual category of the product. See [this](https://www.nordiskarum.se/mexico-matbord-o140-svart-alu-teak.html) for example.
  Therefore it's quite difficult/require custom logic to map products with categories.
  Currently no solution yet.

### K-rauta

- Not all products belong to a leaf category. Some belong to 2nd-to-last category.

### Bygghemma

- Does not show original price despite being on campaign.
- For a leaf category, pressing the "next" button will go to the next page using
  JS. But the a.href points to the next page of the 2nd-to-last category instead.
  For example, see [this page](https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matbord-och-koksbord/?page=2) and search for `div.WfGIO a`.
- Sometimes they add a letter "S" to the end of the article number from Venture Design. For example they changed `GR14001 -> GR14001S` [here](https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-estelle-140-med-4-valentina-stolar-sammet/p-1117252).
