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

const { Core } = require('@adobe/aio-sdk')
const { errorResponse, stringParameters } = require('../utils');
const { generateTargetHtml } = require('./render');

/**
 * Parameters
 * @param {Object} params The parameters object
 * @param {string} params.__ow_path The path of the request
 * @param {string} params.configName Overwrite for HLX_CONFIG_NAME using query parameter
 * @param {string} params.contentUrl Overwrite for HLX_CONTENT_URL using query parameter
 * @param {string} params.storeUrl Overwrite for HLX_STORE_URL using query parameter
 * @param {string} params.productsTemplate Overwrite for HLX_PRODUCTS_TEMPLATE using query parameter
 * @param {string} params.pathFormat Overwrite for HLX_PATH_FORMAT using query parameter
 * @param {string} params.HLX_CONFIG_NAME The config sheet to use (e.g. configs for prod, configs-dev for dev)
 * @param {string} params.HLX_CONTENT_URL Edge Delivery URL of the store (e.g. aem.live)
 * @param {string} params.HLX_STORE_URL Public facing URL of the store
 * @param {string} params.HLX_PRODUCTS_TEMPLATE URL to the products template page
 * @param {string} params.HLX_PATH_FORMAT The path format to use for parsing
 */
async function main (params) {
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    logger.debug(stringParameters(params))
    
    // Retrieve base product
    const targetHtml = await generateTargetHtml(sku, urlKey, context);

    const response = {
      statusCode: 200,
      body: targetHtml,
    }
    logger.info(`${response.statusCode}: successful request`)
    return response;

  } catch (error) {
    logger.error(error)
    // Return appropriate status code if specified
    if (error.statusCode) {
      return errorResponse(error.statusCode, error.message, logger);
    }
    return errorResponse(500, 'server error', logger);
  }
}

exports.main = main
