const mapProducts = (products) => {
  if (!products || products.length === 0) return []
  return products.map((product) => {
    const prd = product.associatedProduct || product.product || product
    if (!prd) return
    const href =
      prd.seoClass?.levelOne && prd.productSlug
        ? `/${prd.seoClass.levelOne}/${prd.productSlug}`
        : null

    return {
      relationship: prd.relationship,
      categoryType: prd.categoryType,
      productCode: prd.productCode,
      productName: prd.name,
      href,
      // TODO: Update the fields below when we have the data
      tags: ['20ul selling size', 'RabMAb', 'Recombinant', 'KO Validated'].join('|'), // We join just cause it's easier to handle in the template
      imageCount: 5,
      image:
        'https://content.abcam.com/products/images/goat-rabbit-igg-h-l-alexa-fluor-488-ab150077--flow-cytometry-img38158.jpg',
    }
  })
}

const mapRelatedProducts = ({
  alternateproducts,
  associatedproducts,
  toprecommendedproducts,
  crosssell,
}) => {
  const alternativeProducts = [
    ...mapProducts(alternateproducts),
    ...mapProducts(
      (associatedproducts || []).filter(({ associatedProduct }) =>
        ['alternativeProduct'].includes(associatedProduct.relationshipType)
      )
    ),
  ]
  const complementaryProducts = [
    ...mapProducts(toprecommendedproducts),
    ...mapProducts(
      ...(associatedproducts || []).filter(({ associatedProduct }) =>
        ['compatibleSecondaries', 'isotypeControl'].includes(associatedProduct.relationshipType)
      )
    ),
    ...mapProducts(crosssell),
  ]

  if (!alternativeProducts.length && !complementaryProducts.length) {
    return null
  }

  return {
    alternativeProducts: alternativeProducts.length ? alternativeProducts : null,
    complementaryProducts: complementaryProducts.length ? complementaryProducts : null,
  }
}

module.exports = { mapRelatedProducts }
