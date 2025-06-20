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
      tags: prd.productTags?.map((tag) => tag.tagCode).join('|'), // We join just cause it's easier to handle in the template
      imageCount: prd.imageCount || 0,
      image: prd.images?.[0]?.seoUrl
        ? {
            url: `https://content.abcam.com/${prd.images[0].seoUrl}`,
            title: prd.images?.[0]?.title || prd.name,
          }
        : null,
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
      (associatedproducts || []).filter(({ relationshipType }) =>
        ['alternativeProduct'].includes(relationshipType)
      )
    ),
  ]
  const complementaryProducts = [
    ...mapProducts(toprecommendedproducts),
    ...mapProducts(
      ...(associatedproducts || []).filter(({ relationshipType }) =>
        ['compatibleSecondaries', 'isotypeControl'].includes(relationshipType)
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
