require('dotenv').config();
const { main } = require('../actions/check-product-changes/index');

(async () => {
    try {
        console.log(new Date().toISOString(), 'Starting the action');
        const resp = await main({
            libInit: {
                ow: {
                    namespace: process.env.AIO_runtime_namespace,
                    auth: process.env.AIO_runtime_auth,
                }
            },
            authToken: process.env.AEM_TOKEN,
            HLX_ORG_NAME: "abcam-ltd",
            HLX_SITE_NAME: "aem-dev",
            HLX_PATH_FORMAT: "/en-us/products/{category}/{slug}",
            COVEO_HOST: "stage.lifesciences.danaher.com",
            COVEO_ORG: "danahernonproduction1892f3fhz",
            COVEO_PIPELINE: "Abcam General",
            COVEO_SEARCHHUB: "AbcamGeneral",
            COVEO_AUTH: process.env.COVEO_AUTH,
            AEM_TOKEN: process.env.AEM_TOKEN,
            LOG_LEVEL: 'info',
        });
        console.log(JSON.stringify(resp, null, 2));
    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        console.log(new Date().toISOString(), 'Finishing the action');
    }
})();
