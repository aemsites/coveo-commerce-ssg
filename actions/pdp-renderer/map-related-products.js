const mapProducts = (products, locale) => {
  if (!products || products.length === 0) return [];

  return products
    .map((product) => {
      const prd = product.associatedProduct || product.product || product;
      if (!prd) return null;

      let href;
      if (prd.seoClass?.levelOne && prd.productSlug) {
        href = locale
          ? `${locale}/products/${prd.seoClass.levelOne}/${prd.productSlug}`
          : `/products/${prd.seoClass.levelOne}/${prd.productSlug}`;
      }

      return {
        relationship: prd.relationship,
        categoryType: prd.categoryType,
        productCode: prd.productCode,
        productName: prd.name,
        reviewSummary: prd.reviewsSummary,
        href,
        tags: prd.productTags?.map((tag) => tag.tagCode).join('|'),
        imageCount: prd.imageCount || 0,
        image: prd.images?.[0]?.seoUrl
          ? {
              url: `https://content.abcam.com/${prd.images[0].seoUrl}`,
              title: prd.images?.[0]?.title || prd.name,
            }
          : null,
      };
    })
    .filter(Boolean); // Removes null entries
};

const mapRelatedProducts = (
  {
    alternateproducts,
    associatedproducts,
    toprecommendedproducts,
    crosssell,
  },
  locale
) => {
  const alternativeProducts = [
    ...mapProducts(alternateproducts, locale),
    ...mapProducts(
      (associatedproducts || []).filter(({ relationshipType }) =>
        ['alternativeProduct'].includes(relationshipType)
      ),
      locale
    ),
  ];

  const complementaryProducts = [
    ...mapProducts(toprecommendedproducts, locale),
    ...mapProducts(
      (associatedproducts || []).filter(({ relationshipType }) =>
        ['compatibleSecondaries', 'isotypeControl'].includes(relationshipType)
      ),
      locale
    ),
    ...mapProducts(crosssell, locale),
  ];

  if (!alternativeProducts.length && !complementaryProducts.length) {
    return null;
  }

  return {
    alternativeProducts: alternativeProducts.length ? alternativeProducts : null,
    complementaryProducts: complementaryProducts.length ? complementaryProducts : null,
  };
};

module.exports = { mapRelatedProducts };
