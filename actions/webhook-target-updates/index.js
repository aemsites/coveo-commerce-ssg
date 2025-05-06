const { Core, State } = require('@adobe/aio-sdk');

/**
 * Webhook handler for product updates
 * Receives a list of IDs via POST and saves them to state
 * 
 * @param {object} params - Action parameters
 * @param {array} params.ids - List of product IDs to be updated
 * @returns {object} Result of the operation
 */
async function main(params) {
  const logger = Core.Logger('webhook-target-updates', { level: params.LOG_LEVEL || 'info' });
  
  // Initialize state library
  const stateLib = await State.init(params.libInit || {});
  
  try {
    logger.info('Received webhook request for target page updates');

    // Parse request body if needed
    let ids = [];
    if (params.__ow_body) {
      try {
        // Handle both string JSON and already parsed objects
        if (typeof params.__ow_body === 'string') {
          ids = JSON.parse(params.__ow_body);
        } else {
          ids = params.__ow_body;
        }
        
        // If the payload has a ids property, use that
        if (ids.ids && Array.isArray(ids.ids)) {
          ids = ids.ids;
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
    } else if (params.ids) {
      // Support direct ids parameter as fallback
      ids = params.ids;
    }

    // Validate input
    if (!Array.isArray(ids) || ids.length === 0) {
      logger.error('Invalid or missing IDs in request');
      return {
        statusCode: 400,
        body: {
          error: 'Invalid request: ids parameter must be a non-empty array'
        }
      };
    }
    
    logger.info(`Processing ${ids.length} IDs`);
    
    // Generate a timestamp-based key using milliseconds since epoch
    const now = new Date();
    const timestampMs = now.getTime(); // Integer value of milliseconds since epoch
    const stateKey = `webhook-ids-updated.${timestampMs}`;
    
    // Store IDs in state with a TTL of 24 hours (86400 seconds)
    await stateLib.put(stateKey, JSON.stringify(ids), { ttl: 86400 });
    
    logger.info(`Successfully stored ${ids.length} IDs in state with key: ${stateKey}`);
    
    return {
      statusCode: 200,
      body: {
        message: 'Target update request received',
        ids_count: ids.length,
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
