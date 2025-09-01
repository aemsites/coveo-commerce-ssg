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

/* This file exposes some common utilities for your actions */

const FILE_PREFIX = 'check-product-changes';
const FILE_TARGET_PREFIX = 'check-target-changes';
const FILE_EXT = 'csv';

/**
 *
 * Returns a log ready string of the action input parameters.
 * The `Authorization` header content will be replaced by '<hidden>'.
 *
 * @param {object} params action input parameters.
 *
 * @returns {string}
 *
 */
function stringParameters (params) {
  // hide authorization token without overriding params
  let headers = params.__ow_headers || {}
  if (headers.authorization) {
    headers = { ...headers, authorization: '<hidden>' }
  }
  return JSON.stringify({ ...params, __ow_headers: headers })
}

/**
 *
 * Returns the list of missing keys giving an object and its required keys.
 * A parameter is missing if its value is undefined or ''.
 * A value of 0 or null is not considered as missing.
 *
 * @param {object} obj object to check.
 * @param {array} required list of required keys.
 *        Each element can be multi level deep using a '.' separator e.g. 'myRequiredObj.myRequiredKey'
 *
 * @returns {array}
 * @private
 */
function getMissingKeys (obj, required) {
  return required.filter(r => {
    const splits = r.split('.')
    const last = splits[splits.length - 1]
    const traverse = splits.slice(0, -1).reduce((tObj, split) => { tObj = (tObj[split] || {}); return tObj }, obj)
    return traverse[last] === undefined || traverse[last] === '' // missing default params are empty string
  })
}

/**
 *
 * Returns the list of missing keys giving an object and its required keys.
 * A parameter is missing if its value is undefined or ''.
 * A value of 0 or null is not considered as missing.
 *
 * @param {object} params action input parameters.
 * @param {array} requiredHeaders list of required input headers.
 * @param {array} requiredParams list of required input parameters.
 *        Each element can be multi level deep using a '.' separator e.g. 'myRequiredObj.myRequiredKey'.
 *
 * @returns {string} if the return value is not null, then it holds an error message describing the missing inputs.
 *
 */
function checkMissingRequestInputs (params, requiredParams = [], requiredHeaders = []) {
  let errorMessage = null

  // input headers are always lowercase
  requiredHeaders = requiredHeaders.map(h => h.toLowerCase())
  // check for missing headers
  const missingHeaders = getMissingKeys(params.__ow_headers || {}, requiredHeaders)
  if (missingHeaders.length > 0) {
    errorMessage = `missing header(s) '${missingHeaders}'`
  }

  // check for missing parameters
  const missingParams = getMissingKeys(params, requiredParams)
  if (missingParams.length > 0) {
    if (errorMessage) {
      errorMessage += ' and '
    } else {
      errorMessage = ''
    }
    errorMessage += `missing parameter(s) '${missingParams}'`
  }

  return errorMessage
}

/**
 *
 * Extracts the bearer token string from the Authorization header in the request parameters.
 *
 * @param {object} params action input parameters.
 *
 * @returns {string|undefined} the token string or undefined if not set in request headers.
 *
 */
function getBearerToken (params) {
  if (params.__ow_headers &&
      params.__ow_headers.authorization &&
      params.__ow_headers.authorization.startsWith('Bearer ')) {
    return params.__ow_headers.authorization.substring('Bearer '.length)
  }
  return undefined
}

/**
 *
 * Returns an error response object and attempts to logger.info the status code and error message
 *
 * @param {number} statusCode the error status code.
 *        e.g. 400
 * @param {string} message the error message.
 *        e.g. 'missing xyz parameter'
 * @param {*} [logger] an optional logger instance object with an `info` method
 *        e.g. `new require('@adobe/aio-sdk').Core.Logger('name')`
 *
 * @returns {object} the error object, ready to be returned from the action main's function.
 *
 */
function errorResponse (statusCode, message, logger) {
  if (logger && typeof logger.info === 'function') {
    logger.info(`${statusCode}: ${message}`)
  }
  return {
    error: {
      statusCode,
      body: {
        error: message
      }
    }
  }
}

/**
 * Makes an HTTP request with a timeout of 60 seconds.
 *
 * @param {string} name a name to identify the request.
 * @param {string} url the URL.
 * @param {object} req request options.
 *
 * @returns {Promise<object|null>} the response as parsed object or null if no content.
 *
 * @throws {Error} if the request fails.
 */
async function request(name, url, req, timeout = 60000) {
  // allow requests for 60s max
  const abortController = new AbortController();
  const abortTimeout = setTimeout(() => abortController.abort(), timeout);

  const resp = await fetch(url, {
    ...req,
    signal: abortController.signal,
  });
  // clear the abort timeout if the request passed
  clearTimeout(abortTimeout);

  let responseText = '';

  if (resp.ok) {
    if (resp.status < 204) {
      // ok with content
      return resp.json();
    } else if (resp.status == 204) {
      // ok but no content
      return null;
    }
  } else {
    try {
      responseText = await resp.text();
    // eslint-disable-next-line no-unused-vars
    } catch (e) { /* nothing to be done */ }
  }

  throw new Error(`Request '${name}' to '${url}' failed (${resp.status}): ${resp.headers.get('x-error') || resp.statusText}${responseText.length > 0 ? ` responseText: ${responseText}` : ''}`);
}

/**
 * Requests data from a spreadsheet.
 *
 * @param {string} name file name of the spreadsheet.
 * @param {string} [sheet] optional sheet name.
 * @param {object} context the context object.
 *
 * @returns {Promise<object>} spreadsheet data as JSON.
 */
async function requestSpreadsheet(name, sheet, context) {
  const { contentUrl } = context;
  let sheetUrl = `${contentUrl}/${name}.json`
  if (sheet) {
    sheetUrl += `?sheet=${sheet}`;
  }
  return request('spreadsheet', sheetUrl);
}

/**
 * Returns the parsed configuration.
 *
 * @param {object} context context object containing the configName.
 *
 * @returns {Promise<object>} configuration as object.
 */
async function getConfig(context) {
  const { configName = 'configs', logger } = context;
  if (!context.config) {
    logger.debug(`Fetching config ${configName}`);
    const configData = await requestSpreadsheet(configName, null, context);
    context.config = configData.data.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {});
  }
  return context.config;
}

/**
 * Requests product from Coveo Service API.
 *
 * @param {string} url to be requested.
 * @param {[string]} skus list of product ids.
  * @param {object} ctx the context object.
 *
 * @returns {Promise<object>} Coveo response as object.
 */
async function requestCOVEO(coveoUrl, skus, ctx) {
  const { logger } = ctx;
  const body = {
    context: { productid: skus, type: "product", host: ctx.config.coveoHost },
    pipeline: ctx.config.coveoPipeline,
    searchHub: ctx.config.coveoSearchHub,
    numberOfResults: skus.length,
  };

  const options = {
    body: JSON.stringify(body),
    method: 'POST',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      authorization: `Bearer ${ctx.config.coveoAuth}`,
    },
  };

  const response = await fetch(coveoUrl, options);
  logger.debug({
    url: coveoUrl.href,
    status: response.status,
    statusText: response.statusText,
  });

  if (!response.ok) {
    logger.warn('failed to fetch product: ', response.status, response.statusText);
    try {
      logger.info('body: ', await response.text());
    } catch {
      logger.error('Error in gettting product from coveo:', e);
    }
    return;
  }

  return await response.json();
}

/**
 * Requests product from Coveo Service API.
 *
 * @param {string} url to be requested.
 * @param {[string]} id list of product ids.
  * @param {object} ctx the context object.
 *
 * @returns {Promise<object>} Coveo response as object.
 */
async function requestTargetCOVEO(coveoUrl, ids, ctx) {
  const { logger } = ctx;
  const body = {
    context: { type: "target", number: ids, host: ctx.config.coveoHost },
    pipeline: ctx.config.coveoPipeline,
    searchHub: ctx.config.coveoSearchHub,
    numberOfResults: ids.length,
  };

  logger.debug(body);

  const options = {
    body: JSON.stringify(body),
    method: 'POST',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      authorization: `Bearer ${ctx.config.coveoAuth}`,
    },
  };

  const response = await fetch(coveoUrl, options);
  logger.debug({
    url: coveoUrl.href,
    status: response.status,
    statusText: response.statusText,
  });

  if (!response.ok) {
    logger.warn('failed to fetch product: ', response.status, response.statusText);
    try {
      logger.info('body: ', await response.text());
    } catch {
      logger.error('Error in gettting product from coveo:', e);
    }
    return;
  }

  return await response.json();
}

/**
 * Requests data from Commerce Catalog Service API.
 *
 * @param {string} query GraphQL query.
 * @param {string} operationName name of the operation.
 * @param {object} variables query variables.
 * @param {object} context the context object.
 *
 * @returns {Promise<object>} GraphQL response as parsed object.
 */
async function requestSaaS(query, operationName, variables, context) {
  const { storeUrl, logger, configOverrides = {} } = context;
  const config = {
    ... (await getConfig(context)),
    ...configOverrides
  };
  const headers = {
    'Content-Type': 'application/json',
    'origin': storeUrl,
    'magento-customer-group': config['commerce.headers.cs.Magento-Customer-Group'],
    'magento-environment-id': config['commerce.headers.cs.Magento-Environment-Id'],
    'magento-store-code': config['commerce.headers.cs.Magento-Store-Code'],
    'magento-store-view-code': config['commerce.headers.cs.Magento-Store-View-Code'],
    'magento-website-code': config['commerce.headers.cs.Magento-Website-Code'],
    'x-api-key': config['commerce.headers.cs.x-api-key'],
    // bypass LiveSearch cache
    'Magento-Is-Preview': true,
  };
  const method = 'POST';

  const response = await request(
    `${operationName}(${JSON.stringify(variables)})`,
    config['commerce-endpoint'],
    {
      method,
      headers,
      body: JSON.stringify({
        operationName,
        query,
        variables,
      })
    }
  );

  // Log GraphQL errors
  if (response?.errors) {
    for (const error of response.errors) {
      logger.error(`Request '${operationName}' returned GraphQL error`, error);
    }
  }

  return response;
}

/**
 * Checks if a given string is a valid URL.
 *
 * @param {string} string - The string to be checked.
 * @returns {boolean} - Returns true if the string is a valid URL, otherwise false.
 */
function isValidUrl(string) {
  try {
    return Boolean(new URL(string));
  } catch {
    return false;
  }
}

  const locales = [
    'zh-cn',
    'ja-jp'
  ];

/**
 * Constructs the URL of a product.
 *
 * @param {Object} product Product with sku and urlKey properties.
 * @param {Object} context The context object containing the store URL and path format.
 * @returns {string} The product url or null if storeUrl or pathFormat are missing.
 */
function getProductUrl(product, locale) {
  let slug = product?.raw?.adproductslug;
  if (slug === '#NAME?') {
    slug = product?.raw?.adassetdefinitionnumber?.toLowerCase();
  }

  const basePath = locales.includes(locale) ? '/products' : `/${locale}/products`;
  return `${basePath}/${product?.raw?.adseoclasslevelone}/${slug}`;
}


function getSanitizedProductUrl(product, locale){
  const slug = product?.raw?.adproductslug;
  if (/^-|--/.test(slug)) {
    const sanitizedSlug = slug?.replace(/-+/g, '-')?.replace(/^-/g, '');
    product.raw.adproductslug = sanitizedSlug;
  }
  return getProductUrl(product, locale);
}

/**
 * Constructs the URL of a product.
 *
 * @param {Object} product Product with sku and urlKey properties.
 */
function getTargetUrl(target, locale) {
  const { tgtnumber, tgtslug } = target?.raw || {};
  const targetnumber = tgtnumber?.replace(/^TGT/, "");
  const basePath = locales.includes(locale) ? '/targets' : `/${locale}/targets`;
  return `${basePath}/${tgtslug}/${targetnumber}`;
}


/**
 * Adjust the context according to the given locale.
 * 
 * TODO: Customize this function to match your multi store setup
 * 
 * @param {string} locale The locale to map.
 * @returns {Object} An object containing the adjusted context.
 */
function mapLocale(locale, context) {
  // Check if locale is valid
  const allowedLocales = ['en', 'fr']; // Or use context.allowedLocales derived from HLX_LOCALES configuration
  if (!locale || !allowedLocales.includes(locale)) {
    throw new Error('Invalid locale');
  }

  // Example for dedicated config file per locale
  return {
    locale,
    configName: [locale, context.configName].join('/'),
  }
}

module.exports = {
  errorResponse,
  getBearerToken,
  stringParameters,
  checkMissingRequestInputs,
  requestSaaS,
  requestCOVEO,
  requestTargetCOVEO,
  getConfig,
  request,
  requestSpreadsheet,
  isValidUrl,
  getProductUrl,
  getSanitizedProductUrl,
  getTargetUrl,
  mapLocale,
  FILE_PREFIX,
  FILE_EXT,
  FILE_TARGET_PREFIX,
}
