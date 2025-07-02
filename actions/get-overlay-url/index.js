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

const { Core, Files } = require('@adobe/aio-sdk');

/**
 * Retrieves the properties of files in the root directory
 * @param {object} params - Action parameters
 * @returns {object} Object containing the directory properties
 */
async function main(params) {
  // Initialize the logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' });
  
  try {
    // Initialize the Files SDK
    const filesLib = await Files.init(params.libInit || {});
    
    // Create a test file
    logger.info('Creating test file');
    const testFileName = '/test-dir';
    const testFileContent = Buffer.from('This is a test file');
    await filesLib.write(testFileName, testFileContent);
    logger.info(`Test file "${testFileName}" created successfully`);
    
    // Get properties of the test file
    logger.info(`Retrieving properties for "${testFileName}"`);
    const fileProperties = await filesLib.getProperties(testFileName);
    
    logger.debug(fileProperties);
    // Extract the ID from the URL
    const url = fileProperties.url;
    // Extract just the base URL without the file path
    const baseUrl = url.match(/(https:\/\/[^"'\s]+?)\/[^\/]+$/)?.[1] || null;
    logger.info(`Extracted base URL: ${baseUrl}`);
    
    const presignUrl = await filesLib.generatePresignURL('check-product-changes/en-us.csv', { expiryInSeconds: 3600 })
    const presignTargetUrl = await filesLib.generatePresignURL('check-target-changes/en-us.csv', { expiryInSeconds: 3600 })
    const presignSanitizedtUrl = await filesLib.generatePresignURL('check-product-changes/sanitized/en-us.csv', { expiryInSeconds: 3600 })

    const presignUrlJP = await filesLib.generatePresignURL('check-product-changes/ja-jp.csv', { expiryInSeconds: 3600 })
    const presignTargetUrlJP = await filesLib.generatePresignURL('check-target-changes/ja-jp.csv', { expiryInSeconds: 3600 })
    const presignSanitizedtUrlJP = await filesLib.generatePresignURL('check-product-changes/sanitized/ja-jp.csv', { expiryInSeconds: 3600 })

    // Delete the test file
    logger.info(`Deleting test file "${testFileName}"`);
    await filesLib.delete(testFileName);
    logger.info(`Test file "${testFileName}" deleted successfully`);
    
    logger.info('Operation completed successfully');
    return {
      statusCode: 200,
      body: { 
        overlayUrl: `${baseUrl}-public/public/pdps`, 
        parseCSVUrl: `${presignUrl}`, 
        parseCSVTargetUrl: `${presignTargetUrl}`, 
        parseCSVSanitizedtUrl: `${presignSanitizedtUrl}`, 
        parseCSVUrlJP: `${presignUrlJP}`, 
        parseCSVTargetUrlJP: `${presignTargetUrlJP}`,
        parseCSVSanitizedtUrlJP: `${presignSanitizedtUrlJP}`
      }
    };
  } catch (error) {
    logger.error(`Error during file operations: ${error.message}`);
    return {
      statusCode: 500,
      body: {
        error: 'Failed to complete file operations',
        message: error.message
      }
    };
  }
}

exports.main = main;
