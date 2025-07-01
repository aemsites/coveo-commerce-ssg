/*
Copyright 2025 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const { Timings, aggregate } = require('../lib/benchmark');
const { AdminAPI } = require('../lib/aem');
const { isValidUrl, getProductUrl, getSanitizedProductUrl } = require('../utils');
const { GetLastModifiedQuery } = require('../queries');
const { Core } = require('@adobe/aio-sdk');
const { generateProductHtml } = require('../pdp-renderer/render');
const crypto = require('crypto');
const { FILE_PREFIX, FILE_EXT, requestCOVEO } = require('../utils');
const BATCH_SIZE = 75;

function getStateFileLocation(stateKey) {
  return `${FILE_PREFIX}/${stateKey}.${FILE_EXT}`;
}


function getSanitizedFileLocation(stateKey) {
  return `${FILE_PREFIX}/sanitized/${stateKey}.${FILE_EXT}`;
}

/**
 * @typedef {Object} PollerState
 * @property {string} locale - The locale (or store code).
 * @property {Array<Object>} skus - The SKUs with last previewed timestamp and hash.
 */

/**
 * @typedef {import('@adobe/aio-sdk').Files.Files} FilesProvider
 */

/**
 * Saves the state to the cloud file system.
 *
 * @param {String} locale - The locale (or store code).
 * @param {Object} aioLibs - The libraries required for loading the state.
 * @param {Object} aioLibs.filesLib - The file library for reading state files.
 * @param {Object} aioLibs.stateLib - The state library for retrieving state information.
 * @returns {Promise<PollerState>} - A promise that resolves when the state is loaded, returning the state object.
 */
async function loadState(locale, aioLibs, logger) {
  logger.debug(`Locale to load state ${locale}`);
  const { filesLib } = aioLibs;
  const stateObj = { locale };
  try {
    const stateKey = locale || 'default';
    const fileLocation = getStateFileLocation(stateKey);
    const buffer = await filesLib.read(fileLocation);
    const stateData = buffer?.toString();
    if (stateData) {
      const lines = stateData.split('\n');
      stateObj.skus = lines.reduce((acc, line) => {
        // the format of the state object is:
        // <sku1>,<timestamp>,<hash>,<path>
        // <sku2>,<timestamp>,<hash>,<path>
        // ...
        // each row is a set of SKUs, last previewed timestamp and hash
        const [sku, time, hash, path] = line.split(',');
        acc[sku] = { lastPreviewedAt: new Date(parseInt(time)), hash, path };
        return acc;
      }, {});
    } else {
      stateObj.skus = {};
    }
  // eslint-disable-next-line no-unused-vars
  } catch (e) {
    stateObj.skus = {};
  }
  return stateObj;
}

/**
 * Saves the state to the cloud file system.
 *
 * @param {String} locale - The locale (or store code).
 * @param {Object} aioLibs - The libraries required for loading the state.
 * @param {Object} aioLibs.filesLib - The file library for reading state files.
 * @param {Object} aioLibs.stateLib - The state library for retrieving state information.
 * @returns {Promise<PollerState>} - A promise that resolves when the state is loaded, returning the state object.
 */
async function loadSanitizedState(locale, aioLibs, logger) {
  logger.debug(`Locale to load state ${locale}`);
  const { filesLib } = aioLibs;
  const stateObj = { locale };
  try {
    const stateKey = locale || 'default';
    const fileLocation = getSanitizedFileLocation(stateKey);
    const buffer = await filesLib.read(fileLocation);
    const stateData = buffer?.toString();
    if (stateData) {
      const lines = stateData.split('\n');
      stateObj.skus = lines.reduce((acc, line) => {
        // the format of the state object is:
        // <sku1>,<timestamp>,<hash>,<path>
        // <sku2>,<timestamp>,<hash>,<path>
        // ...
        // each row is a set of SKUs, last previewed timestamp and hash
        const [sku, source, destination] = line.split(',');
        acc[sku] = { source, destination };
        return acc;
      }, {});
    } else {
      stateObj.skus = {};
    }
  // eslint-disable-next-line no-unused-vars
  } catch (e) {
    stateObj.skus = {};
  }
  return stateObj;
}

/**
 * Saves the state to the cloud file system.
 *
 * @param {PollerState} state - The object describing state and metadata.
 * @param {Object} aioLibs - The libraries required for loading the state.
 * @param {Object} aioLibs.filesLib - The file library for reading state files.
 * @param {Object} aioLibs.stateLib - The state library for retrieving state information.
 * @returns {Promise<void>} - A promise that resolves when the state is saved.
 */
async function saveState(locale, state, aioLibs) {
  const { filesLib } = aioLibs;
  const stateKey = locale || 'default';
  const fileLocation = getStateFileLocation(stateKey);
  const csvData = [
    ...Object.entries(state.skus)
      .map(([sku, { lastPreviewedAt, hash, path }]) => {
        return `${sku},${lastPreviewedAt.getTime()},${hash || ''},${path}`;
      }),
  ].join('\n');
  return await filesLib.write(fileLocation, csvData);
}

/**
 * Saves the state to the cloud file system.
 *
 * @param {PollerState} state - The object describing state and metadata.
 * @param {Object} aioLibs - The libraries required for loading the state.
 * @param {Object} aioLibs.filesLib - The file library for reading state files.
 * @param {Object} aioLibs.stateLib - The state library for retrieving state information.
 * @returns {Promise<void>} - A promise that resolves when the state is saved.
 */
async function saveSanitizedState(locale, state, aioLibs) {
  const { filesLib } = aioLibs;
  const stateKey = locale || 'default';
  const fileLocation = getSanitizedFileLocation(stateKey);
  const csvData = [
    ...Object.entries(state.skus)
      .map(([sku, { source, destination }]) => {
        return `${sku},${source},${destination}`;
      }),
  ].join('\n');
  return await filesLib.write(fileLocation, csvData);
}

/**
 * Deletes the state from the cloud file system.
 *
 * @param {String} locale - The key of the state to be deleted.
 * @param {FilesProvider} filesLib - The Files library instance from '@adobe/aio-sdk'.
 * @returns {Promise<void>} - A promise that resolves when the state is deleted.
 */
async function deleteState(locale, filesLib) {
  const stateKey = `${locale}`;
  const fileLocation = getStateFileLocation(stateKey);
  await filesLib.delete(fileLocation);
}

/**
 * Checks the Adobe Commerce store for product changes, performs
 * preview/publish/delete operstions if needed, then updates the
 * state accordingly.
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.HLX_SITE_NAME - The name of the site (repo or repoless).
 * @param {string} params.HLX_PATH_FORMAT - The URL format for product detail pages.
 * @param {string} params.HLX_ORG_NAME - The name of the organization.
 * @param {string} params.HLX_CONFIG_NAME - The name of the configuration json/xlsx.
 * @param {string} params.HLX_PRODUCTS_TEMPLATE URL to the products template page
 * @param {string} params.authToken - The authentication token.
 * @param {string} [params.HLX_STORE_URL] - The store's base URL.
 * @param {string} [params.HLX_LOCALES] - Comma-separated list of allowed locales.
 * @param {string} [params.LOG_LEVEL] - The log level.
 * @param {FilesProvider} filesLib - The files provider object.
 * @returns {Promise<Object>} The result of the polling action.
 */
function checkParams(params) {
  const requiredParams = ['HLX_SITE_NAME', 'HLX_PATH_FORMAT', 'HLX_ORG_NAME', 'HLX_CONFIG_NAME', 'authToken'];
  const missingParams = requiredParams.filter(param => !params[param]);
  if (missingParams.length > 0) {
    throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
  }

  if (params.HLX_STORE_URL && !isValidUrl(params.HLX_STORE_URL)) {
    throw new Error('Invalid storeUrl');
  }
}

/**
 * Creates batches of products for processing
 * @param products
 * @param context
 * @returns {*}
 */
function createBatches(skus) {
  return skus.reduce((acc, sku) => {

    if (!acc.length || acc[acc.length - 1].length === BATCH_SIZE) {
      acc.push([]);
    }
    acc[acc.length - 1].push(sku);

    return acc;
  }, []);
}

/**
 * Returns array of promises for preview and publish
 * @param batches
 * @param locale
 * @param adminApi
 * @returns {*}
 */
function previewAndPublish(batches, locale, adminApi) {
  let batchNumber = 0;
  return batches.reduce((acc, batch) => {
    batchNumber++;
    acc.push(adminApi.previewAndPublish(batch, locale, batchNumber));
    return acc;
  }, []);
}

/**
 * Returns array of promises for unpublish and delete
 * @param batches
 * @param locale
 * @param adminApi
 * @returns {*}
 */
function unpublishAndDelete(batches, locale, adminApi) {
    let batchNumber = 0;
    return batches.reduce((acc, batch) => {
        batchNumber++;
        acc.push(adminApi.unpublishAndDelete(batch, locale, batchNumber));
        return acc;
    }, []);
}

/**
 * Checks if a product should be processed
 * @param product
 * @returns {boolean}
 */
function shouldProcessProduct(product) {
  const { currentHash, newHash } = product;
  return product?.raw?.adseoclasslevelone && product?.raw?.adproductslug && currentHash !== newHash;
}

/**
 * Processes a product to determine if it needs to be updated
 * @param {Object} product - The product to process
 * @param {Object} state - The current state
 * @param {Object} context - The context object with logger and other utilities
 * @returns {Object} Enhanced product with additional metadata
 */
async function enrichProductWithMetadata(product, state, sanitizedState, context, locale) {
  const { logger, aioLibs } = context;
  const { sku: skuOriginal, adproductslug: urlKey } = product?.raw;
  const sku = skuOriginal.split('-')[0].toLowerCase();
  logger.info('sku - urlKey', sku, urlKey);
  const lastPreviewDate = state.skus[sku]?.lastPreviewedAt || new Date(0);
  let newHash = null;
  let productHtml = null;
  
  try {
    if (/-{2,}/.test(product?.raw?.adproductslug)) {
        const source = getProductUrl(product, locale);
        const dest = getSanitizedProductUrl(product, locale);
      sanitizedState.skus[sku] = {
        sku,
        source,
        dest
      };
      saveSanitizedState(locale, sanitizedState, aioLibs);
    }
    productResponse = await generateProductHtml(product, context, state);
    productHtml = productResponse?.body;
    newHash = crypto.createHash('sha256').update(productHtml).digest('hex');
    
    // Create enriched product object
    const enrichedProduct = {
      ...product,
      sku,
      urlKey,
      lastPreviewDate,
      currentHash: state.skus[sku]?.hash || null,
      newHash,
      productHtml
    };
    
    // Save HTML immediately if product should be processed
    if (shouldProcessProduct(enrichedProduct) && productHtml) {
      try {
        const { filesLib } = context.aioLibs;
        const productPath = getSanitizedProductUrl(product, locale);
        const htmlPath = `/public/pdps${productPath}`;
        await filesLib.write(htmlPath, productHtml);
        logger.debug(`Saved HTML for product ${sku} to ${htmlPath}`);
      } catch (e) {
        logger.error(`Error saving HTML for product ${sku}:`, e);
      }
    } else {
      logger.debug(`Skipping product ${sku} because it should not be processed`);
      context.counts.ignored++;
    }
    
    return enrichedProduct;
  } catch (e) {
    logger.error(`Error generating product HTML for SKU ${sku}:`, e);
    context.counts.failed++;
    // Return product with metadata even if HTML generation fails
    return {
      ...product,
      sku,
      urlKey,
      lastPreviewDate,
      currentHash: state.skus[sku]?.hash || null,
      newHash: state.skus[sku]?.hash || null,
      productHtml: null
    };
  }
}

/**
 * Processes publish batches and updates state
 */
async function processPublishBatches(promiseBatches, locale, state, counts, products, aioLibs, failedSkus) {
  const response = await Promise.all(promiseBatches);
  for (const { records, previewedAt, publishedAt } of response) {
    if (previewedAt && publishedAt) {
      records.map((record) => {
        const product = products.find(p => p.sku === record.sku);
        state.skus[record.sku] = {
          lastPreviewedAt: previewedAt,
          hash: product?.newHash,
          path: record.path
        };
        counts.published++;
      });
    } else {
      counts.failed += records.length;
      const skus= records.map(item => item.sku);
      failedSkus.push(...skus);
    }
    await saveState(locale, state, aioLibs);
  }
}

function enrichWithPath(skus, state, logger){
  logger.debug("enriching record with product path :", skus)
  const records = [];
  skus.forEach((sku) => {
    const record = {};
    record.sku = sku;
    record.path = state.skus[sku]?.path;
    records.push(record);
  })
  logger.debug("enriched record with product path :", records)
  return records;
}

/**
 * Identifies and processes products that need to be deleted
 */
async function processUnpublishBatches(skus, locale, state, counts, context, adminApi, aioLibs, logger) {
  if (!skus.length) return;
  logger.debug("processUnpublishBatches --- locale", skus, locale);
  try {
    const { filesLib } = aioLibs;

    // Process in batches
    if (skus.length) {
      // delete in batches of BATCH_SIZE, then save state in case we get interrupted
      const batches = createBatches(skus, context);
      const products = await Promise.all(
        batches?.map(skus => enrichWithPath(skus, state, logger))
      );
      const promiseBatches = unpublishAndDelete(products, locale, adminApi);

      const response = await Promise.all(promiseBatches);
      for (const { records, liveUnpublishedAt, previewUnpublishedAt } of response) {
        if (liveUnpublishedAt && previewUnpublishedAt) {
          records.map((record) => {
            // Delete the HTML file from public storage
            try {
              const product = skus.find(p => p.sku === record.sku);
              if (product) {
                const productUrl = state.skus[product]?.path;
                const htmlPath = `/public/pdps${productUrl}`;
                filesLib.delete(htmlPath);
                logger.debug(`Deleted HTML file for product ${record.sku} from ${htmlPath}`);
              }
            } catch (e) {
              logger.error(`Error deleting HTML file for product ${record.sku}:`, e);
            }
            
            delete state.skus[record.sku];
            counts.unpublished++;
          });
        } else {
          counts.failed += records.length;
        }
        await saveState(locale, state, aioLibs);
      }
    }
  } catch (e) {
    logger.error('Error processing deleted products:', e);
  }
}

function getCountry(key){
  if(!key) return '';
  const match = key.match(/webhook-skus-(?:updated|removed)-(\w+)\./);
  const countryCode = match?.[1] || '';
  return countryCode;
}

// function getSiteName(name, key) {
//   const countryCode = getCountry(key);
  
//   if (['cn', 'jp'].includes(countryCode)) {
//     return `${name}-${countryCode}`;
//   }

//   return name;
// }


function makeContext(params) {
	const ctx = {};
	ctx.path = params.__ow_path;
	ctx.method = params.__ow_method;
  ctx.headers = params.__ow_headers;
  ctx.body = params.__ow_body;
  ctx.config = {
    apitoken: params.AEM_TOKEN,
    coveoHost: params.COVEO_HOST,
    coveoOrg: params.COVEO_ORG,
    coveoPipeline: params.COVEO_GENERAL_PIPELINE,
    coveoSearchHub: params.COVEO_GENERAL_SEARCHHUB,
    coveoAuth: params.COVEO_AUTH,
  }
	return ctx;
}

async function fetcher(params, aioLibs) {
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'error' });
  const { stateLib } = aioLibs;
  const wskContext = makeContext(params, logger);
  const {
    HLX_SITE_NAME: siteName,
    HLX_ORG_NAME: orgName,
    authToken,
  } = params;

  const counts = {
    published: 0, unpublished: 0, ignored: 0, failed: 0,
  };
  const sharedContext = {
    logger, counts, aioLibs
  };
  const timings = new Timings();

  const context = {
    ...wskContext,
    ...sharedContext,
  }
  const failedSkus = [];
  const coveoUrl = new URL(`https://${wskContext.config.coveoOrg}.org.coveo.com/rest/search/v2`);

  let adminApi;
  
  try {
    // Get the first key only
    let firstKey = null;
    for await (const { keys } of stateLib.list({ match: 'webhook-skus-*' })) {
      if (keys.length > 0) {
        firstKey = keys[0];
        break;
      }
    }
    const country = getCountry(firstKey);
    // const siteNameCountry = getSiteName(siteName, firstKey);
    const locales = {
      cn: 'zh-cn',
      jp: 'ja-jp'
    };

    const locale = locales[country] || 'en-us';

    logger.info(`Fetching for locale ${locale}`);
    // load state
    const state = await loadState(locale, aioLibs, logger);
    const sanitizedState = await loadSanitizedState(locale, aioLibs, logger);
    timings.sample('loadedState');

    adminApi = new AdminAPI({
      org: orgName,
      site: siteName,
    }, sharedContext, { authToken });

    // start processing preview and publish queues
    await adminApi.startProcessing();
        
    if (firstKey) {
      logger.info(`Processing single key: ${firstKey}`);
      const skusState = await stateLib.get(firstKey);
      
      try {
        const skus = JSON.parse(skusState.value);
        const batches = createBatches(skus);
        logger.info(`Created ${batches.length} batches from ${skus.length} SKUs`);
        
        if(firstKey.includes('updated')){
          // Process each batch sequentially to maintain log order
          for (const batch of batches) {
            const resp = await requestCOVEO(coveoUrl, batch, context);
            timings.sample('fetchedData');
            logger.info(`Fetched data for ${resp?.results?.length} SKUs`);
            logger.debug('COVEO response:', JSON.stringify(resp, null, 2));
            const results = Array.isArray(resp?.results) ? resp.results : [];
            // Enrich products with metadata
            const products = await Promise.all(
              results?.map(product => enrichProductWithMetadata(product, state, sanitizedState, context, locale))
            );
            
            const filteredProducts = products.filter(product => product).filter(shouldProcessProduct);
            const filteredPaths = filteredProducts.map(product => ({ 
              sku: product.sku, 
              path: getSanitizedProductUrl(product, locale)
            }));

            logger.info(`Filtered down to ${filteredPaths.length} products that need updating`);
            
            if (filteredPaths.length > 0) {
              const promiseBatches = previewAndPublish([filteredPaths], locale, adminApi);
              await processPublishBatches(promiseBatches, locale, state, counts, products, aioLibs, failedSkus);
              timings.sample('publishedPaths');
            }
          }
        } else {
          processUnpublishBatches(skus, locale, state, counts, context, adminApi, aioLibs, logger); 
        }
        
        // After processing, delete the key
        if (counts.failed > 0) {
          logger.info(`Failed to process ${counts.failed} products, not deleting key: ${firstKey}`);
        } else {
          await stateLib.delete(firstKey);
          logger.info(`Deleted processed key: ${firstKey}`);
        }

      } catch (e) {
        logger.error(`Error processing key ${firstKey}:`, e);
      }
    } else {
      logger.info('No keys found to process');
    }
    
    // Aggregate timings
    for (const [name, values] of Object.entries(timings.measures)) {
      if (Array.isArray(values)) {
        timings.measures[name] = aggregate(values);
      }
    }
    
    if (adminApi.previewDurations && adminApi.previewDurations.length > 0) {
      timings.measures.previewDuration = aggregate(adminApi.previewDurations);
    }
    
    await adminApi.stopProcessing();
  } catch (e) {
    logger.error('Error in fetcher:', e);
    // wait for queues to finish, even in error case
    await adminApi.stopProcessing();
  }
  
  const elapsed = new Date() - timings.now;
  logger.info(`Finished fetching, elapsed: ${elapsed}ms`);

  // Return the result after all operations are complete
  return {
    state: 'completed',
    elapsed,
    status: { ...counts },
    failedSkus,
    timings: timings.measures,
  };
}

module.exports = {
  fetcher,
  deleteState,
  loadState,
  saveState,
  getStateFileLocation,
};