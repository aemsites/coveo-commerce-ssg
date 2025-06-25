/**
 * @typedef {{[key: string]: {path: string}}} Skus
 */

/**
 * @param {string} str
 * @param {RegExp} match
 * @param {(match: string) => string} replacementFn
 */
const findAndReplaceContent = (str, match, replacementFn) => {
  const parts = str?.split(match)
  for (let i = 1; i < parts.length; i += 2) {
    try {
      parts[i] = replacementFn(parts[i])
    } catch (e) {
      console.error(e)
    }
  }

  return parts.join('')
}

/**
 * AB[0-9]{1,10}' - matches product code. "ab" followed by 1-10 digits
 * (?:\b|_) - matches word boundaries or underscores
 * (?<!<a(?:\s|\n|\r)[^>]*) - negative lookbehind to exclude product codes inside anchor tags
 */
const regex = /(?<!<a(?:\s|\n|\r)[^>]*)(?:\b|_)(AB[0-9]{1,10})(?:\b|_)(?![^<]*<\/a>)/

const validAbIdRegex = new RegExp(regex, 'gi')

/**
 * This function accepts a string (or HTML) and replaces all occurrences of valid AB IDs with anchor tags.
 * It skips the current pdp page's AB ID.
 * @param {string} content
 * @param {string} currentProductCode
 * @param {Skus} skus
 * @returns {string}
 */
const linkifyContent = (content, currentProductCode, skus, logger) => {
  return findAndReplaceContent(content, validAbIdRegex, (productCode) => {
    if (!productCode) {
      return content
    }

    const abId = productCode.toLowerCase()

    if (currentProductCode.toLowerCase().trim() === abId.trim()) {
      return abId
    }

    const href = skus?.[abId]?.path

    if (!href) {
      return abId
    }

    return `<a href=${href}>${abId}</a>`
  })
}

/**
 * This function accepts a product and replaces all occurrences of valid AB IDs with anchor tags.
 * @param {object} product
 * @param {Skus} skus
 * @returns {object}
 */
const linkifyAbids = (product, skus, logger) => {
  if (!skus) return product
  const currentProductCode = product.raw?.ec_product_id?.toLowerCase() || ''

  const linkifyHandler = (content) => linkifyContent(content, currentProductCode, skus, logger)

  const updatedProduct = { ...product }
  updatedProduct.notes = product.notes?.map((note) => ({
    ...note,
    statement: linkifyHandler(note.statement || ''),
  }))
  updatedProduct.summarynotes = product.summarynotes?.map((note) => ({
    ...note,
    statement: linkifyHandler(note.statement || ''),
  }))
  updatedProduct.images = product.images?.map((image) => {
    return {
      ...image,
      imgLegend: linkifyHandler(image.imgLegend || ''),
      imagesusage: JSON.parse(linkifyHandler(image.imgImageUsageJSON || '')),
    }
  })
  updatedProduct.applications = product.applications?.map((app) => ({
    ...app,
    species: app.species?.map((species) => ({
      ...species,
      notes: linkifyHandler(species.notes || ''),
    })),
  }))
  updatedProduct.tabledata = product.tabledata?.map((table) => {
    const updatedTable = { ...table }
    for (const key in updatedTable) {
      if (updatedTable[key]?.notes) {
        updatedTable[key].notes = linkifyHandler(updatedTable[key].notes)
      }
    }
    return updatedTable
  })
  updatedProduct.applications = product.applications?.map((application) => ({
    ...application,
    species: application.species?.map((species) => ({
      ...species,
      notes: linkifyHandler(species.notes || ''),
    })),
  }))

  return updatedProduct
}

module.exports = { linkifyAbids }
