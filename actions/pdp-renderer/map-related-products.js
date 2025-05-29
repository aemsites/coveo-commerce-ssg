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
    ...mapProducts(associatedproducts),
    ...mapProducts(alternateproducts),
  ]
  const complementaryProducts = [...mapProducts(toprecommendedproducts), ...mapProducts(crosssell)]

  if (!alternativeProducts.length && !complementaryProducts.length) {
    return null
  }

  return {
    alternativeProducts: alternativeProducts.length ? alternativeProducts : null,
    complementaryProducts: complementaryProducts.length ? complementaryProducts : null,
  }
}

module.exports = { mapRelatedProducts }
