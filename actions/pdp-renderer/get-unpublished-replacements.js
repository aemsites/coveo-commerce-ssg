const getUnpublishedReplacements = (adunpublishedattributes) => {
  if (!adunpublishedattributes) return null

  try{
    const unpublishedAttributes = JSON.parse(adunpublishedattributes);
    const directReplacementProduct = unpublishedAttributes?.directReplacementProduct
      ? [unpublishedAttributes.directReplacementProduct]
      : []
    const alternativeProducts = unpublishedAttributes?.alternativeProducts || []
    return [...directReplacementProduct, ...alternativeProducts].reduce((acc, product) => {
      if (product.status === 'ACTIVE' && !acc.find((p) => p.productCode === product.productCode)) {
        acc.push(product)
      }
      return acc
    }, [])
  } catch (err) {
    console.error('Failed to parse JSON:', err.message);
  }
}

module.exports = { getUnpublishedReplacements }
