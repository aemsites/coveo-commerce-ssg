/**
 * This script generates a product HTML page using the provided product data.
 * It uses the `generateProductHtml` function from `actions/pdp-render/renderer`.
 * To test it, copy the raw data of a product from Coveo to the mocks file and import it here.
 * Then, update the `raw` property of the product object with the imported mock data.
 * Then run the script with `node runners/test-pdp-renderer.js`.
 * The generated HTML will be saved to `runners/test.html` and opened in the default browser.
 */

require('dotenv').config()
const { Core } = require('@adobe/aio-sdk')
const { generateProductHtml } = require('../actions/pdp-renderer/render')
const fs = require('fs')
const exec = require('child_process').exec

const {
  ab108821,
  ab216880,
  ab277918,
  ab288118,
  ab290,
  ab32536,
  unpublished1,
  unpublished2,
} = require('./mocks')

const main = async () => {
  try {
    const product = {
      raw: ab108821,
      title: 'Goat Anti-Rabbit IgG H&L (Alexa Fluor® 488)',
      uri: 'product://ab150077-abcam/',
      printableUri: 'product://ab150077-abcam/',
      clickUri: 'product://ab150077-abcam/',
      uniqueId: '42.33881$product://ab150077-abcam/',
      excerpt: '"product://ab150077-abcam"',
      firstSentences: null,
      summary: null,
      flags: 'HasHtmlVersion;SkipSentencesScoring;HasAllMetaDataStream',
      hasHtmlVersion: true,
      hasMobileHtmlVersion: false,
      score: 1468,
      percentScore: 86.21433,
      rankingInfo: null,
      rating: 0.0,
      isTopResult: false,
      isRecommendation: false,
      isUserActionView: false,
      titleHighlights: [],
      firstSentencesHighlights: [],
      excerptHighlights: [],
      printableUriHighlights: [],
      summaryHighlights: [],
      parentResult: null,
      childResults: [],
      totalNumberOfChildResults: 0,
      absentTerms: [],
      Title: 'Goat Anti-Rabbit IgG H&L (Alexa Fluor® 488)',
      Uri: 'product://ab150077-abcam/',
      PrintableUri: 'product://ab150077-abcam/',
      ClickUri: 'product://ab150077-abcam/',
      UniqueId: '42.33881$product://ab150077-abcam/',
      Excerpt: '"product://ab150077-abcam"',
      FirstSentences: null,
    }
    const stateObj = {
      skus: {
        ab290: { path: '/en-us/primary/ab290' },
        ab176842: { path: '/en-us/primary/ab176842' },
        ab171870: { path: '/en-us/primary/ab171870' },
        ab6721: { path: '/en-us/primary/ab6721' },
        ab15077: { path: '/en-us/primary/ab15077' },
        ab181548: { path: '/en-us/primary/ab181548' },
      },
    }
    const logger = Core.Logger('main', { level: 'info' })
    const result = await generateProductHtml(
      product,
      { logger },
      stateObj,
      'en-us',
      `${__dirname}/../actions/`
    )
    const filePath = `${__dirname}/test.html`
    fs.writeFileSync(filePath, result.body)
    exec(getCommandLine() + ' ' + filePath)
  } catch (error) {
    console.error('An error occurred:', error)
  } finally {
    console.log(new Date().toISOString(), 'Finishing the action')
  }
}

function getCommandLine() {
  switch (process.platform) {
    case 'darwin':
      return 'open'
    case 'win32':
    case 'win64':
      return 'start'
    default:
      return 'xdg-open'
  }
}

main()
