const { errorResponse } = require('../utils');
const { Files } = require('@adobe/aio-sdk')
const fs = require('fs');
const Handlebars = require('handlebars');
const { linkifyAbids } = require('./linkify-abids');

Handlebars.registerHelper("eq", function(a, b) {
  return a?.toLowerCase() === b?.toLowerCase();
});

Handlebars.registerHelper("lt", function(a, b) {
  return a < b;
});

Handlebars.registerHelper("len", function(a, b) {
  b = b || 0;
  return Array.isArray(a) ? a.length-b : 0;
});

Handlebars.registerHelper('getReactType', function(context, field) {
  return context[field]?.suitability || '';
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

Handlebars.registerHelper('stripTags', function(text) {
  return text.replace(/(<([^>]+)>)/gi, "");
});

Handlebars.registerHelper('toLowerCase', function(str) {
  return str.toLowerCase();
});

Handlebars.registerHelper('isOneOf', function(value, options) {
  const validValues = options.hash.values.split(',');
  return validValues.includes(value) ? true : false;
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

Handlebars.registerHelper("or", function (a, b) {
  return a || b;
});

Handlebars.registerHelper("and", function (a, b) {
  return a && b;
});

Handlebars.registerHelper("replaceTagTitle", function (value) {
  switch (value) {
    case 'RABMAB':
      return 'RabMAb®';
    case 'RECOMBINANT':
      return 'Recombinant';
    default:
      return value;
  }
});

function parseJson(jsonString) {
  try {
    return jsonString ? JSON.parse(jsonString) : null;
  } catch (e) {
    return null;
  }
}

async function generateProductHtml(product, ctx, state) {
  // const path = state.skus[sku]?.path || '';
  const { logger } = ctx;

  try {
    // const product = JSON.parse(data?.toString());
    logger.debug(product?.raw?.adproductslug || "No adproductslug found");

    product.categorytype = product.raw.adcategorytype;
    product.reviewssummary = parseJson(product.raw.reviewssummaryjson);
    product.targetdata = parseJson(product.raw.targetjson);
    product.target = parseJson(product.raw.adprimarytargetjson);
    product.alternativenames = product.target?.adPrimaryTargetAlternativeNames?.split('|')?.join(', ') || product.target?.adPrimaryTargetAlternativeNames;
    product.targetrelevance = parseJson(product.target?.adPrimaryTargetRelevanceJSON)
    product.targetfunction = product.targetrelevance?.function?.join('. ');
    product.targetposttranslationalmodifications = product.targetrelevance?.postTranslationalModifications?.join('. ');
    product.targetsequencesimilarities = product.targetrelevance?.sequenceSimilarities?.join('. ');
    product.targetattr = parseJson(product.raw.adsecondaryantibodyattributesjson);
    product.biochemicalattr = parseJson(product.raw.adbiochemicalattributesjson);
    product.celltargetattr = parseJson(product.raw.adcelllinetargetattributesjson);
    if (product.celltargetattr) {
      product.celltargetattr.knockoutvalidation = product.celltargetattr?.geneEditedCellLineKnockoutValidations?.join(', ');
      product.celltargetattr.strlocus = product.celltargetattr?.strLocus?.join(', ');
      product.celltargetattr.cultureproperties = product.celltargetattr?.cultureProperties?.join(', ');
    }
    product.cellattr = parseJson(product.raw.adcelllineattributesjson);
    if (product.cellattr) product.cellattr.subcultureguidelines = product.cellattr?.subcultureGuidelines?.join(', ')
    product.conjugations = parseJson(product.raw.adconjugationsjson);
    product.notes = parseJson(product.raw?.adnotesjson);
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
    product.sequenceinfo = product.raw.adproteinaminoacidsequencesjson;
    product.sequenceinfotag = parseJson(product.sequenceinfo)?.tags?.at(0);
    product.kitcomponent = parseJson(product.raw.adkitcomponentdetailsjson);
    product.immunogenlinkjson = parseJson(product.raw.adimmunogendatabaselinksjson)?.at(0);
    product.immunogendesc = product.raw.adimmunogendescription;
    product.purificationnotes = parseJson(product?.raw?.adpurificationnotesjson)?.at(0)?.statement || '';
    product.standardproteinisoforms = parseJson(product?.raw?.adstandardproteinisoformsjson)?.at(0);
    product.subcellularlocalisations = product.standardproteinisoforms?.subcellularLocalisations?.at(0);
    product.purificationtechnique = product?.raw?.adpurificationtechniquereagent || '' + product?.raw?.adpurificationtechnique || '';
    product.conjugatevariations = parseJson(product?.raw?.advariationsjson);
    product.dissociationconstant = parseJson(product?.raw?.adantibodydissociationconstantjson);
    product.speciesreactivity = parseJson(product?.raw?.adspeciesreactivityjson);
    product.secondaryantibodytargetisotypes = product?.raw?.adsecondaryantibodyattributestargetisotypes?.split(';')?.join(', ') || '';
    product.variations = parseJson(product.raw?.advariationsjson);

    // load the templates
    const templateNames = [
      "page",
      "overview-section",
      "datasheet-section",
      "support-section",
      "product-header-block",
      "product-overview-block",
      "product-buybox-block",
      "product-keyfacts-block",
      "product-variations-block",
      "product-alternate-block",
      "product-publications-block",
      "product-target-block",
      "product-reactivity-block",
      "product-datasheet-block",
      "product-protocols-block",
      "product-storage-block",
      "product-notes-block",
      "product-summarynotes-block",
      "product-promise-block",
      "associated-products-block",
      "product-downloads-block",
      "product-sequenceinfo-block",
      "product-specifications-block",
      "product-general-info-block",
      "product-properties-block",
      "product-quality-control-block",
      "product-cell-culture-block",
      "product-handling-procedures-block",
      "product-precision-block",
      "product-recovery-block",
      "section-metadata-block",
      "product-kitcomponent-block",
      "meta-jsonld",
      "product-reactivity-jsonld"
  ];
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
    const linkifiedProduct = linkifyAbids(product, state.skus, logger);
    const html = template(linkifiedProduct);
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
