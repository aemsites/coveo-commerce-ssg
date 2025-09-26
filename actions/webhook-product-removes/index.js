const { Core, State } = require('@adobe/aio-sdk');

/**
 * Webhook handler for product updates
 * Receives a list of SKUs via POST and saves them to state
 * 
 * @param {object} params - Action parameters
 * @param {array} params.skus - List of product SKUs to be updated
 * @returns {object} Result of the operation
 */
async function main(params) {
  const logger = Core.Logger('webhook-product-removes', { level: params.LOG_LEVEL || 'info' });
  
  // const authHeader = params.__ow_headers?.authorization || "";
  
  // if (!authHeader.startsWith("Basic ")) {
  //   return { statusCode: 401, body: "Unauthorized" };
  // }

  // const [uName, pWord] = params.AIO_AUTH.split(":");
  // const base64Credentials = authHeader.split(" ")[1];
  // const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
  // const [username, password] = credentials.split(":");

  // if (username !== uName || password !== pWord) {
  //   return { statusCode: 403, body: `Forbidden` };
  // }
  
  // Initialize state library
  const stateLib = await State.init(params.libInit || {});
  
  try {
    logger.info('Received webhook request for product removes');

    // Parse request body if needed
    let skus = [];
    const country = params.__ow_path?.replace(/\//g, "-") || '';
    if (params.__ow_body) {
      try {
        // Handle both string JSON and already parsed objects
        if (typeof params.__ow_body === 'string') {
          skus = JSON.parse(params.__ow_body);
        } else {
          skus = params.__ow_body;
        }
        
        // If the payload has a skus property, use that
        if (skus.skus && Array.isArray(skus.skus)) {
          skus = skus.skus;
        }
      } catch (e) {
        logger.error(`Error parsing request body: ${e.message}`);
        return {
          statusCode: 400,
          body: {
            error: 'Invalid request: could not parse request body'
          }
        };
      }
    } else if (params.skus) {
      // Support direct skus parameter as fallback
      skus = params.skus;
    }

    // Validate input
    if (!Array.isArray(skus) || skus.length === 0) {
      logger.error('Invalid or missing SKUs in request');
      return {
        statusCode: 400,
        body: {
          error: 'Invalid request: skus parameter must be a non-empty array'
        }
      };
    }
    
    logger.info(`Processing ${skus.length} SKUs`);
    
    // Generate a timestamp-based key using milliseconds since epoch
    const now = new Date();
    const timestampMs = now.getTime(); // Integer value of milliseconds since epoch
    const stateKey = `webhook-skus-removed${country}.${timestampMs}`;
    
    // Store SKUs in state with a TTL of 24 hours (86400 seconds)
    await stateLib.put(stateKey, JSON.stringify(skus), { ttl: 86400 });
    
    logger.info(`Successfully stored ${skus.length} SKUs in state with key: ${stateKey}`);
    
    return {
      statusCode: 200,
      body: {
        message: 'Product remove request received',
        skus_count: skus.length,
        timestamp: now.toISOString()
      }
    };
  } catch (error) {
    logger.error(`Error processing webhook: ${error.message}`);
    return {
      statusCode: 500,
      body: {
        error: 'Internal server error',
        message: error.message
      }
    };
  }
}

exports.main = main;
