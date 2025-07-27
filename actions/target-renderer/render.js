const { errorResponse } = require('../utils');
const { Files } = require('@adobe/aio-sdk')
const fs = require('fs');
const Handlebars = require('handlebars');

Handlebars.registerHelper("eq", function(a, b) {
  return a?.toLowerCase() === b?.toLowerCase();
});

Handlebars.registerHelper("lt", function(a, b) {
  return a < b;
});

Handlebars.registerHelper("gt", function(a, b) {
  return a > b;
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
  if(image && image.resourceType?.toLowerCase() === 'image') {
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

function getFormattedDate(previewedDate){
  const date = new Date(previewedDate);

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');

  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');

  const isoWithoutMs = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
  return isoWithoutMs;
}

async function generateTargetHtml(target, ctx, state) {
  const { logger } = ctx;

  try {
    logger.debug(target?.raw?.tgttargetgroupingname || "No target page found");

    target.title = `${target.raw.tgtname} | Abcam `;
    target.publihseddate = getFormattedDate(target?.raw?.indexeddate);
    target.relevancejson = parseJson(target.raw.tgtrelevancejson);
    target.function = target?.relevancejson?.function;
    target.involvementindisease = target?.relevancejson?.involvementInDisease;
    target.posttranslationalmodifications = target?.relevancejson?.postTranslationalModifications;
    target.sequencesimilarities = target?.relevancejson?.sequenceSimilarities;
    target.cellularlocalization = target?.relevancejson?.cellularLocalization;
    target.linkeddatasource = parseJson(target?.raw?.tgtlinkeddatasourcejson);
    target.developmentalstage = target?.relevancejson?.developmentalStage;
    target.domain = target?.relevancejson?.domain;
    target.pathway = target?.relevancejson?.pathway;
    target.sequencesimilarities = target?.relevancejson?.sequenceSimilarities;
    target.tissuespecificity = target?.relevancejson?.tissueSpecificity;
    target.alternativenames = target?.raw?.tgtalternativenames?.split('|')?.join(', ') || '';

    target.researchareasprimary = '';
    target.researchareasother = [];
    target.researchareas = target?.raw?.tgtresearchareas?.split('|');
    target.researchareas?.forEach((item, index) => {
      if(index === 0) {
        target.researchareasprimary = item?.trim();
      } else {      
        target.researchareasother.push(item?.trim());
      }
    });

    // load the templates
    const templateNames = [
      "target-page",
      "target-overview-section"
    ];
    let template = '';
    templateNames.forEach((templateName) => {
      const templateContent = fs.readFileSync(
        __dirname + `/templates/us/${templateName}.html`,
        'utf-8'
      );
      if (templateContent) {
        if (templateName === 'target-page') {
          template = Handlebars.compile(templateContent);
        }
        {
          Handlebars.registerPartial(templateName, templateContent);
        }
      }
    });

    // render the main template with the content
    const html = template(target);
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
  generateTargetHtml,
};
