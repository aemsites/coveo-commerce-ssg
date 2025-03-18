const { errorResponse } = require('../utils');
const { Files } = require('@adobe/aio-sdk')
const fs = require('fs');
const Handlebars = require('handlebars');

Handlebars.registerHelper("eq", function(a, b) {
  return a === b;
});

Handlebars.registerHelper("lt", function(a, b) {
  return a < b;
});

Handlebars.registerHelper("len", function(a, b) {
  b = b || 0;
  return Array.isArray(a) ? a.length-b : 0;
});

Handlebars.registerHelper('getReactType', function(context, field) {
  return context[field]?.reactivityType || '';
});

Handlebars.registerHelper('getReactNotes', function(context, field) {
  return context[field]?.notes || '';
});

Handlebars.registerHelper('getReactDilution', function(context, field) {
  return context[field]?.recommendeddilution || '';
});

Handlebars.registerHelper("concat", function(...args) {
  return args.filter(arg => typeof arg === "string").join("/");
});

Handlebars.registerHelper("extractNumber", function(value) {
  const match = value.match(/\d+/);
  return match ? match[0] : "";
});

Handlebars.registerHelper("isValidImageUrl", function(image, options) {
  if(image && image.resourceType === 'Image') {
    return options.fn(this);
  }
  return options.inverse(this);
});

Handlebars.registerHelper('replaceSlash', function(text) {
  return text.replace(/[^a-zA-Z0-9]/g, "");
});

Handlebars.registerHelper('toLowerCase', function(str) {
  return str.toLowerCase();
});

Handlebars.registerHelper("object", function () {
    let obj = {};
    for (let i = 0; i < arguments.length - 1; i += 2) {
        if (arguments[i + 1] !== undefined && arguments[i + 1] !== null && arguments[i + 1] !== "") {
            obj[arguments[i]] = arguments[i + 1];
        }
    }
    return obj;
});

Handlebars.registerHelper("json", function (context) {
    return JSON.stringify(context, null, 2);
});

Handlebars.registerHelper("join", function (array, separator, key) {
  if (!Array.isArray(array)) return "";
  return array.map(item => (key ? item[key] : item)).join(separator);
});

Handlebars.registerHelper("array", function () {
  let arr = [];
  for (let i = 0; i < arguments.length - 1; i++) {
      if (arguments[i] !== undefined && arguments[i] !== null && arguments[i] !== "") {
          arr.push(arguments[i]);
      }
  }
  return arr;
});

Handlebars.registerHelper("filter", function (array, key) {
  if (!Array.isArray(array)) return [];
  return array.filter(item => item[key] !== undefined && item[key] !== null && item[key] !== "");
});

function parseJson(jsonString) {
  try {
    return jsonString ? JSON.parse(jsonString) : null;
  } catch (e) {
    return null;
  }
}

async function generateProductHtml(product, ctx) {
  const { logger } = ctx;
  try {
    // const product = JSON.parse(data?.toString());
    logger.debug(product?.raw?.adproductslug || "No adproductslug found");

    product.categorytype = product.raw.adcategorytype?.toLowerCase()?.replace(/ /g, '-');
    product.reviewssummary = parseJson(product.raw.reviewssummaryjson);
    product.targetdata = parseJson(product.raw.targetjson);
    product.target = parseJson(product.raw.adprimarytargetjson);
    product.alternativenames = product.target?.adPrimaryTargetAlternatenames?.split('|');
    product.notes =  parseJson(product.raw.adnotesjson);
    product.images = parseJson(product.raw.imagesjson);
    product.applications = parseJson(product.raw.adapplicationreactivityjson);
    product.tabledata = parseJson(product.raw.reactivitytabledata);
    product.summarynotes = parseJson(product.raw.adtargetsummarynotesjson);
    product.associatedproducts = parseJson(product.raw.adassociatedproductsjson);
    product.alternateproducts = parseJson(product.raw.addirectreplacementjson);
    if (product.alternateproducts) product.alternateproducts.type = product.alternateproducts?.categoryType?.toLowerCase()?.replace(/ /g, '-');
    product.toprecommendedproducts = parseJson(product.raw.adtoprecommendedproductsjson);
    product.toprecommendedproducts?.forEach((toprecommendedproduct) => {
      if (toprecommendedproduct) {
        toprecommendedproduct.type = toprecommendedproduct?.categoryType?.toLowerCase()?.replace(/ /g, '-');
      }
    });
    if (product.alternateproducts) {
      product.toprecommendedproducts = [];
    }
    product.publications = parseJson(product.raw.adpublicationsjson)?.items;
    product.sampletypes = parseJson(product.raw.adkitsampletypesjson);

    product.publications?.forEach((publication) => {
      publication.publicationYear = new Date(publication.publicationDate).getFullYear();
    });
    product.protocolsdownloads = parseJson(product.raw.adproductprotocols);

    // load the templates
    const templateNames = ctx.config.templates || [];
    let template = '';
    templateNames.forEach((templateName) => {
      const templateContent = fs.readFileSync(
        __dirname + `/templates/us/${templateName}.html`,
        'utf-8'
      );
      if (templateContent) {
        if (templateName === 'page') {
          template = Handlebars.compile(templateContent);
        }
        {
          Handlebars.registerPartial(templateName, templateContent);
        }
      }
    });

    // render the main template with the content
    const html = template(product);
    logger.debug('HTML :', html);
    const response = {
      statusCode: 200,
      body: html,
    };

    logger.info(`${response.statusCode}: successful request`);
    return response;

  } catch (error) {
    logger.error(`Error parsing JSON for key: ${ctx.path}`, error);
  }
}

module.exports = {
  generateProductHtml,
};
