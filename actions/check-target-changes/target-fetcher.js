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
const { isValidUrl, getTargetUrl } = require('../utils');
const { GetLastModifiedQuery } = require('../queries');
const { Core } = require('@adobe/aio-sdk');
const { generateTargetHtml } = require('../target-renderer/render');
const crypto = require('crypto');
const { FILE_TARGET_PREFIX, FILE_EXT, requestTargetCOVEO } = require('../utils');
const BATCH_SIZE = 150;

function getStateFileLocation(stateKey) {
  return `${FILE_TARGET_PREFIX}/${stateKey}.${FILE_EXT}`;
}

/**
 * @typedef {Object} PollerState
 * @property {string} locale - The locale (or store code).
 * @property {Array<Object>} ids - The ids with last previewed timestamp and hash.
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
  const { filesLib } = aioLibs;
  const stateObj = { locale };
  logger.debug(`Locale to load state ${locale}`);
  try {
    const stateKey = locale || 'default';
    const fileLocation = getStateFileLocation(stateKey);
    logger.info("fileLocation :: ",fileLocation);
    const buffer = await filesLib.read(fileLocation);
    const stateData = buffer?.toString();
    if (stateData) {
      const lines = stateData.split('\n');
      stateObj.ids = lines.reduce((acc, line) => {
        // the format of the state object is:
        // <id1>,<timestamp>,<hash>,<path>
        // <id2>,<timestamp>,<hash>,<path>
        // ...
        // each row is a set of ids, last previewed timestamp, hash and name
        const items = line.split(',');
        const [id, time, hash, path, name] = [items[0], items[1], items[2], items[3], items.slice(4).join(',')]
        acc[id.toLowerCase()] = { lastPreviewedAt: new Date(parseInt(time)), hash, path, name };
        return acc;
      }, {});
    } else {
      stateObj.ids = {};
    }
  // eslint-disable-next-line no-unused-vars
  } catch (e) {
    stateObj.ids = {};
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
    ...Object.entries(state.ids)
      .map(([id, { lastPreviewedAt, hash, path, name }]) => {
        return `${id},${lastPreviewedAt.getTime()},${hash || ''},${path},${name}`;
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
 * Creates batches of targets for processing
 * @param targets
 * @param context
 * @returns {*}
 */
function createBatches(ids) {
  return ids.reduce((acc, id) => {

    if (!acc.length || acc[acc.length - 1].length === BATCH_SIZE) {
      acc.push([]);
    }
    acc[acc.length - 1].push(id?.toLowerCase());

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
function shouldProcessTarget(target) {
  const { currentHash, newHash } = target;
  return currentHash !== newHash;
}

/**
 * Processes a product to determine if it needs to be updated
 * @param {Object} product - The product to process
 * @param {Object} state - The current state
 * @param {Object} context - The context object with logger and other utilities
 * @returns {Object} Enhanced product with additional metadata
 */
async function enrichTargetWithMetadata(target, state, context, locale) {
  const { logger } = context;
  // Need to be updated
  const { tgtnumber: skuOriginal } = target?.raw;
  // Need to be updated
  logger.info('tgtnumber - ', skuOriginal);
  const id = skuOriginal;
  const lastPreviewDate = state.ids[id]?.lastPreviewedAt || new Date(0);
  let newHash = null;
  let targettHtml = null;
  
  try {
    targetResponse = await generateTargetHtml(target, context, state);
    targettHtml = targetResponse?.body;
    newHash = crypto.createHash('sha256').update(targettHtml).digest('hex');
    
    // Create enriched product object
    const enrichedTarget = {
      ...target,
      id,
      lastPreviewDate,
      currentHash: state.ids[id]?.hash || null,
      newHash,
      targettHtml
    };
    
    // Save HTML immediately if product should be processed
    if (shouldProcessTarget(enrichedTarget) && targettHtml) {
      try {
        const { filesLib } = context.aioLibs;
        const targetPath = getTargetUrl(target, locale);
        const htmlPath = `/public/pdps${targetPath}`;
        await filesLib.write(htmlPath, targettHtml);
        logger.debug(`Saved HTML for product ${id} to ${htmlPath}`);
      } catch (e) {
        logger.error(`Error saving HTML for product ${id}:`, e);
      }
    } else {
      logger.debug(`Skipping product ${id} because it should not be processed`);
      context.counts.ignored++;
    }
    
    return enrichedTarget;
  } catch (e) {
    logger.error(`Error generating product HTML for id ${id}:`, e);
    context.counts.failed++;
    // Return product with metadata even if HTML generation fails
    return {
      ...target,
      id,
      lastPreviewDate,
      currentHash: state.ids[id]?.hash || null,
      newHash: state.ids[id]?.hash || null,
      targettHtml: null
    };
  }
}

/**
 * Processes publish batches and updates state
 */
async function processPublishBatches(promiseBatches, locale, state, counts, targets, aioLibs, failedIds) {
  const response = await Promise.all(promiseBatches);
  for (const { records, previewedAt, publishedAt } of response) {
    if (previewedAt && publishedAt) {
      records.map((record) => {
        const product = targets.find(p => p.id === record.id);
        state.ids[record.id] = {
          lastPreviewedAt: previewedAt,
          hash: product?.newHash,
          path: record.path,
          name: record.name
        };
        counts.published++;
      });
    } else {
      counts.failed += records.length;
      const ids= records.map(item => item.id);
      failedIds.push(...ids);
    }
    await saveState(locale, state, aioLibs);
  }
}

function enrichWithPath(ids, state, logger) {
  logger.debug("Enriching records with product paths:", ids);

  const records = ids.map((id) => ({
    id,
    path: state.ids?.[id]?.path || '', 
  }));

  logger.debug("Enriched records:", records);
  return records;
}

/**
 * Identifies and processes targets that need to be deleted
 */
async function processDeletedTargets(ids, locale, state, counts, context, adminApi, aioLibs, logger) {
  if (!ids.length) return;
  logger.debug("processDeletedTargets --- locale", ids, locale);
  try {
    const { filesLib } = aioLibs;

    // Process in batches
    if (ids.length) {
      // delete in batches of BATCH_SIZE, then save state in case we get interrupted
      const batches = createBatches(ids, context);
      const targets = batches?.map(ids => enrichWithPath(ids, state, logger));

      const promiseBatches = unpublishAndDelete(targets, locale, adminApi);

      const response = await Promise.all(promiseBatches);
      for (const { records, liveUnpublishedAt, previewUnpublishedAt } of response) {
        if (liveUnpublishedAt && previewUnpublishedAt) {
          records.map((record) => {
            // Delete the HTML file from public storage
            try {
              const target = ids.find(p => p.id === record.id);
              if (target) {
                const targetUrl = state.ids[id]?.path;
                const htmlPath = `/public/pdps${targetUrl}`;
                filesLib.delete(htmlPath);
                logger.debug(`Deleted HTML file for product ${record.id} from ${htmlPath}`);
              }
            } catch (e) {
              logger.error(`Error deleting HTML file for product ${record.id}:`, e);
            }
            
            delete state.ids[record.id];
            counts.unpublished++;
          });
        } else {
          counts.failed += records.length;
        }
        await saveState(locale, state, aioLibs);
      }
    }
  } catch (e) {
    logger.error('Error processing deleted targets:', e);
  }
}

function getCountry(key){
  const match = key.match(/webhook-ids-(?:updated|removed)-(\w+)\./);
  const countryCode = match?.[1] || '';
  return countryCode;
}

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
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' });
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
  const failedIds = [];
  const coveoUrl = new URL(`https://${wskContext.config.coveoOrg}.org.coveo.com/rest/search/v2`);
  try {
    // Get the first key only
    let firstKey = null;
    for await (const { keys } of stateLib.list({ match: 'webhook-ids-*' })) {
      if (keys.length > 0) {
        firstKey = keys[0];
        break;
      }
    }

    const country = getCountry(firstKey);
    const locales = {
      cn: 'zh-cn',
      jp: 'ja-jp'
    };

    const locale = locales[country] || 'en-us';
    logger.info(`Fetching for locale ${locale}`);

    // load state
    const state = await loadState(locale, aioLibs, logger);
    timings.sample('loadedState');

    const adminApi = new AdminAPI({
      org: orgName,
      site: siteName,
    }, sharedContext, { authToken });

    // start processing preview and publish queues
    await adminApi.startProcessing();

    if (firstKey) {
      logger.info(`Processing single key: ${firstKey}`);
      const idsState = await stateLib.get(firstKey);
      
      try {
        const ids = JSON.parse(idsState.value);
        const batches = createBatches(ids);
        logger.info(`Created ${batches.length} batches from ${ids.length} ids`);
        
        if(firstKey.includes('updated')) {
          // Process each batch sequentially to maintain log order
          for (const batch of batches) {
            const resp = await requestTargetCOVEO(coveoUrl, batch, context);
            timings.sample('fetchedData');
            logger.info(`Fetched data for ${resp?.results?.length} ids`);
            const results = Array.isArray(resp?.results) ? resp.results : [];
            // Enrich targets with metadata
            const targets = await Promise.all(
              results?.map(target => enrichTargetWithMetadata(target, state, context, locale))
            );
            
            const filteredTargets = targets.filter(target => target).filter(shouldProcessTarget);
            const filteredPaths = filteredTargets.map(target => ({ 
              id: target.id, 
              path: getTargetUrl(target, locale),
              name: target.raw.tgtname
            }));

            logger.info(`Filtered down to ${filteredPaths.length} targets that need updating`);
            
            if (filteredPaths.length > 0) {
              const promiseBatches = previewAndPublish([filteredPaths], locale, adminApi);
              await processPublishBatches(promiseBatches, locale, state, counts, targets, aioLibs, failedIds);
              timings.sample('publishedPaths');
            }
          }
        } else {
          logger.info(`Processing deletion of ${ids}`);
          processDeletedTargets(ids, locale, state, counts, context, adminApi, aioLibs, logger); 
        }

        const now = new Date();
        const timestampMs = now.getTime(); // Milliseconds since epoch

        // After processing, delete the key
        if (counts.failed > 0) {
          logger.error(`Failed to process ${counts.failed} products, creating new webhook with failed SKUs and deleting key: ${firstKey}`);
          const sKey = `${firstKey?.split('.')[0]}.${timestampMs}`;
          logger.error(`Webhook request created with failed SKUs: ${sKey}`);
          // Store Failed SKUs in state with a TTL of 24 hours (86400 seconds)
          await stateLib.put(sKey, JSON.stringify(failedIds), { ttl: 86400 });
        } else {
          logger.info(`Deleted processed key: ${firstKey}`);
        }

        // Delete the original key regardless of success/failure
        await stateLib.delete(firstKey);

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
    failedIds,
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