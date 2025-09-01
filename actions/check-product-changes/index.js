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

const { Core, State, Files } = require('@adobe/aio-sdk');
const { fetcher } = require('./fetcher');
const { ObservabilityClient } = require('../lib/observability');

async function main(params) {
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' });
  const observabilityClient = new ObservabilityClient(logger, {
    token: params.AEM_TOKEN, 
    endpoint: params.LOG_INGESTOR_ENDPOINT,
    org: params.HLX_ORG_NAME,
    site: params.HLX_SITE_NAME
  });
  const stateLib = await State.init(params.libInit || {});
  const filesLib = await Files.init(params.libInit || {});

  const running = await stateLib.get('running');
  if (running?.value === 'true') {
    const result = { state: 'skipped' };
    await observabilityClient.sendActivationResult(result);
    return result;
  }

  try {
    // if there is any failure preventing a reset of the 'running' state key to 'false',
    // this might not be updated and action execution could be permanently skipped
    // a ttl == function timeout is a mitigation for this risk
    await stateLib.put('running', 'true', { ttl: 3600 });
    const result = await fetcher(params, { stateLib, filesLib });
    await observabilityClient.sendActivationResult(result);
    return result;
  } finally {
    await stateLib.delete('running');
  }
}

exports.main = main
