const { errorResponse } = require('../utils');
const { State, Files } = require('@adobe/aio-sdk');
const fs = require('fs');
const Handlebars = require('handlebars');
const { linkifyAbids } = require('./linkify-abids');
const { getUnpublishedReplacements } = require('./get-unpublished-replacements');
const { loadState } = require('../check-target-changes/target-fetcher');

Handlebars.registerHelper("eq", function(a, b) {
  return a?.toLowerCase() === b?.toLowerCase();
});

Handlebars.registerHelper("eqnumber", function(a, b) {
  return a === b;
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
  const escapedString = context[field]?.notes?.replace(/"/g, '\\"');
  return escapedString || '';
});

Handlebars.registerHelper('getReactDilution', function(context, field) {
  return context[field]?.recommendeddilution || '';
});

Handlebars.registerHelper('escapeQuotes', function (text) {
  return text.replace(/"/g, '\\"');
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
  return text?.replace(/[^a-zA-Z0-9]/g, "");
});

Handlebars.registerHelper('stripTags', function(text) {
  return text?.replace(/(<([^>]+)>)/gi, "");
});

Handlebars.registerHelper('toLowerCase', function(str) {
  return str?.toLowerCase();
});

Handlebars.registerHelper('isOneOf', function(value, options) {
  const validValues = options.hash.values.split(',');
  return validValues.includes(value?.toLowerCase()) ? true : false;
});

Handlebars.registerHelper('isNotOneOf', function(value, options) {
  const validValues = options.hash.values.split(',');
  return validValues.includes(value?.toLowerCase()) ? false : true;
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

async function getRelatedTargets(relatedTargets, aioLibs, locale, logger){
  const targets = relatedTargets?.split('|');
  // load target state
  const state = await loadState(locale, aioLibs, logger);
  let additionalTargets = [];
  targets?.forEach(target =>{
    additionalTargets.push(state.ids[target?.toLowerCase()]?.name);
  })
  return additionalTargets.join(',');
}

function getAntibodyPurity(technique, reagent, fraction){
  if (technique && reagent) {
    return `${technique} ${reagent}`
  } else if (technique || reagent) {
    return technique || reagent
  }

  return fraction ? fraction : undefined
}

function sanitizeString(str) {
  return str
    .replace(/\\+_/g, '_')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getFormattedDate(indexedDate) {
  const indexeddate = new Date(indexedDate);

  const yyyy = indexeddate.getUTCFullYear();
  const mm = String(indexeddate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(indexeddate.getUTCDate()).padStart(2, '0');

  const hh = String(indexeddate.getUTCHours()).padStart(2, '0');
  const min = String(indexeddate.getUTCMinutes()).padStart(2, '0');
  const ss = String(indexeddate.getUTCSeconds()).padStart(2, '0');

  const isoWithoutMs = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
  return isoWithoutMs;
}

Handlebars.registerHelper('trimColons', function (text) {
  if (typeof text === 'string') {
    return text.replace(/:\s*/g, ' : '); // Removes leading and trailing colons
  }
  return text; // Return as-is if not a string
});

function createLocalizer(localisedJson, locale = 'en-us') {
  return function(key) {
    const item = localisedJson.find(entry => entry.Key === key);
    return item ? item[locale] : null;
  };
}

function convertJsonKeysToLowerCase(jsonObj) {
  if (!jsonObj) return "";
  return Object.fromEntries(
    Object.entries(jsonObj).map(([key, value]) => [key.toLowerCase(), value])
  );
}

const localeCnJp = ['zh-cn', 'ja-jp'];

async function generateProductHtml(product, ctx, state, locale, dirname = __dirname) {
  const { logger } = ctx;
  const { localisedJson } = state;
  logger.debug(localisedJson || "No localisedJson found");
  const getLocalizedValue = createLocalizer(localisedJson, locale);
  try {
    // const product = JSON.parse(data?.toString());
    logger.debug(product?.raw?.adproductslug || "No adproductslug found");
    product.status = product.raw.adstatus?.toLowerCase();
    product.publihseddate = getFormattedDate(product?.raw?.indexeddate);
    logger.debug("published Date :",product.publihseddate);
    product.locale = (localeCnJp.includes(locale)) ? null :  `/${locale}`;
    product.isUnpublishedProduct = (product.status === "inactive" || product.status === "quarantined") && !!product?.raw?.adunpublishedattributes;
    product.isLegacyUnpublished = product.raw.adseoclasslevelone === 'unavailable';
    product.protocolsdownloads = product.isUnpublishedProduct ? parseJson(product.raw?.adunpublishedattributes)?.protocols : parseJson(product.raw.adproductprotocols);
    product.protocolsdownloads?.forEach((link) => {
      if (link.url) {
        link.url = product.isLegacyUnpublished ? `https://doc.abcam.com/${link.url}` : `https://content.abcam.com/content/dam/abcam/product/${link.url}`;
        logger.debug(link.url);
      }
    })
    product.unpublishedReplacements = getUnpublishedReplacements(product?.raw?.adunpublishedattributes);

    if(product.status !== 'inactive' && product.status !== 'quarantined'){

      product.keyfacts = getLocalizedValue('key-facts');
      product.hostspecies = getLocalizedValue('host-species');
      product.clonality = getLocalizedValue('clonality');
      product.clonenumber = getLocalizedValue('clone-number');
      product.isotype = getLocalizedValue('isotype');
      product.lightchaintype = getLocalizedValue('light-chain-type');
      product.conjugation = getLocalizedValue('conjugation');
      product.excitation = getLocalizedValue('excitation');
      product.emission = getLocalizedValue('emission');
      product.carrierfree = getLocalizedValue('carrier-free');
      product.targetspecies = getLocalizedValue('target-species');
      product.reactswith = getLocalizedValue('reacts-with');
      product.applicationsheading = getLocalizedValue('applications');
      product.immunogen = getLocalizedValue('immunogen');
      product.epitope = getLocalizedValue('epitope');
      product.specificity = getLocalizedValue('specificity');
      product.targetisotype = getLocalizedValue('target-isotype');
      product.targetspecificity = getLocalizedValue('target-specificity');
      product.minimalcrossreactivity = getLocalizedValue('minimal-cross-reactivity');
      product.preadsorbed = getLocalizedValue('pre-adsorbed');
      product.target = getLocalizedValue('target');
      product.assaytype = getLocalizedValue('assay-type');
      product.storagebuffer = getLocalizedValue('storage-buffer');
      product.form = getLocalizedValue('form');
      product.purityheading = getLocalizedValue('purity');
      product.reconstitution = getLocalizedValue('reconstitution');
      product.casnumber = getLocalizedValue('cas-number');
      product.source = getLocalizedValue('source');
      product.molecularweight = getLocalizedValue('molecular-weight');
      product.molecularformula = getLocalizedValue('molecular-formula');
      product.pubchem = getLocalizedValue('pubchem');
      product.nature = getLocalizedValue('nature');
      product.solubility = getLocalizedValue('solubility');
      product.biochemicalname = getLocalizedValue('biochemical-name');
      product.biologicaldescription = getLocalizedValue('biological-description');
      product.canonicalsmiles = getLocalizedValue('canonical-smiles');
      product.isomericsmiles = getLocalizedValue('isomeric-smiles');
      product.inchi = getLocalizedValue('inchi');
      product.inchikey = getLocalizedValue('inchikey');
      product.iupacname = getLocalizedValue('iupac-name');
      product.detectionmethod = getLocalizedValue('detection-method');
      product.sampletypesheading = getLocalizedValue('sample-types');
      product.sensitivity = getLocalizedValue('sensitivity');
      product.range = getLocalizedValue('range');
      product.assaytime = getLocalizedValue('assay-time');
      product.assayplatform = getLocalizedValue('assay-platform');
      product.generalrecovery = getLocalizedValue('general-recovery');
      product.endotoxinlevel = getLocalizedValue('endotoxin-level');
      product.expressionsystem = getLocalizedValue('expression-system');
      product.tags = getLocalizedValue('tags');
      product.biologicallyactive = getLocalizedValue('biologically-active');
      product.biologicalactivity = getLocalizedValue('biological-activity');
      product.massspectrometry = getLocalizedValue('mass-spectrometry');
      product.accession = getLocalizedValue('accession');
      product.animalfree = getLocalizedValue('animal-free');
      product.species = getLocalizedValue('species');
      product.celltype = getLocalizedValue('cell-type');
      product.speciesororganism = getLocalizedValue('species-or-organism');
      product.tissue = getLocalizedValue('tissue');
      product.knockoutvalidation = getLocalizedValue('knockout-validation');
      product.mutationdescription = getLocalizedValue('mutation-description');
      product.antibioticresistance = getLocalizedValue('antibiotic-resistance');
      product.disease = getLocalizedValue('disease');
      product.associatedproductsheading = getLocalizedValue('associated-products');
      product.recommendedalternatives = getLocalizedValue('recommended-alternatives');
      product.relatedconjugatesandformulations = getLocalizedValue('related-conjugates-and-formulations');
      product.reactivitydata = getLocalizedValue('reactivity-data');
      product.haveyouthoughtaboutthisalternative = getLocalizedValue('have-you-thought-about-this-alternative');
      product.whyisthisrecommended = getLocalizedValue('why-is-this-recommended');
      product.youmaybeinterestedin = getLocalizedValue('you-may-be-interested-in');
      product.productdetails = getLocalizedValue('product-details');
      product.sequenceinfoheading = getLocalizedValue('sequence-info');
      product.precision = getLocalizedValue('precision');
      product.recovery = getLocalizedValue('recovery');
      product.whatsincluded = getLocalizedValue('whats-included');
      product.propertiesandstorageinformation = getLocalizedValue('properties-and-storage-information');
      product.purificationtechniqueheading = getLocalizedValue('purification-technique');
      product.purificationnotesheading = getLocalizedValue('purification-notes');
      product.genename = getLocalizedValue('gene-name');
      product.geneeditingtype = getLocalizedValue('gene-editing-type');
      product.geneeditingmethod = getLocalizedValue('gene-editing-method');
      product.zygosity = getLocalizedValue('zygosity');
      product.shippedatconditions = getLocalizedValue('shipped-at-conditions');
      product.appropriateshorttermstorageduration = getLocalizedValue('appropriate-short-term-storage-duration');
      product.appropriateshorttermstorageconditions = getLocalizedValue('appropriate-short-term-storage-conditions');
      product.appropriatelongtermstorageconditions = getLocalizedValue('appropriate-long-term-storage-conditions');
      product.aliquotinginformation = getLocalizedValue('aliquoting-information');
      product.storageinformation = getLocalizedValue('storage-information');
      product.handlingprocedures = getLocalizedValue('handling-procedures');
      product.initialhandlingguidelines = getLocalizedValue('initial-handling-guidelines');
      product.subcultureguidelines = getLocalizedValue('subculture-guidelines');
      product.culturemedium = getLocalizedValue('culture-medium');
      product.cryopreservationmedium = getLocalizedValue('cryopreservation-medium');
      product.supplementaryinfo = getLocalizedValue('supplementary-info');
      product.activitysummary = getLocalizedValue('activity-summary');
      product.associateddiseasesanddisorders = getLocalizedValue('associated-diseases-and-disorders');
      product.specifications = getLocalizedValue('specifications');
      product.additionalnotes = getLocalizedValue('additional-notes');
      product.generalinfo = getLocalizedValue('general-info');
      product.function = getLocalizedValue('function');
      product.sequencesimilarities = getLocalizedValue('sequence-similarities');
      product.posttranslationalmodifications = getLocalizedValue('post-translational-modifications');
      product.subcellularlocalisation = getLocalizedValue('subcellular-localisation');
      product.qualitycontrol = getLocalizedValue('quality-control');
      product.stranalysis = getLocalizedValue('str-analysis');
      product.cellculture = getLocalizedValue('cell-culture');
      product.biosafetylevel = getLocalizedValue('biosafety-level');
      product.adherentsuspension = getLocalizedValue('adherentsuspension');
      product.gender = getLocalizedValue('gender');
      product.viability = getLocalizedValue('viability');
      product.productprotocols = getLocalizedValue('product-protocols');
      product.targetdataheading = getLocalizedValue('target-data');
      product.additionaltargets = getLocalizedValue('additional-targets');
      product.publicationsheading = getLocalizedValue('publications');
      product.productpromise = getLocalizedValue('product-promise');
      product.productpromise1 = getLocalizedValue('product-promise-p1');
      product.productpromise2 = getLocalizedValue('product-promise-p2');
      product.productpromise3 = getLocalizedValue('product-promise-p3');
      product.productpromise4 = getLocalizedValue('product-promise-p4');
      product.viewalternnamesheading = getLocalizedValue('view-alternative-names');
      product.whatisthis = getLocalizedValue('what-is-this');

      product.host = ctx.config.coveoHost;
      const localisedtitle = convertJsonKeysToLowerCase(parseJson(product.raw.adassetdefinitionnamelocalisedjson));
      product.englishtitle = locale === 'en-us' ? null : product.title;
      product.title = localisedtitle[locale] || product.title;

      const localisedgentitle = convertJsonKeysToLowerCase(parseJson(product.raw.adgentitlelocalisedjson));
      const localisedmetatitle = convertJsonKeysToLowerCase(parseJson(product.raw.admetatitlelocalisedjson));
      product.productmetatitle = localisedmetatitle[locale] || localisedgentitle[locale] || product.title;

      const localisedgenshortdescription = convertJsonKeysToLowerCase(parseJson(product.raw.adgenshortdescriptionlocalisedjson));
      const localisedmetadescription = convertJsonKeysToLowerCase(parseJson(product.raw.admetadescriptionlocalisedjson));
      product.productmetadescription = localisedmetadescription[locale] || localisedgenshortdescription[locale] || '';
      product.raw.admetadescription = product.raw.admetadescription?.trim();

      product.categorytype = product.raw.adcategorytype;
      product.reviewssummary = parseJson(product.raw.reviewssummaryjson);
      product.targetdata = parseJson(product.raw.targetjson);
      product.target = parseJson(product.raw.adprimarytargetjson);
      product.alternativenames = product.target?.adPrimaryTargetAlternativeNames?.split('|')?.join(', ') || product.target?.adPrimaryTargetAlternativeNames;
      product.targetrelevance = parseJson(product.target?.adPrimaryTargetRelevanceJSON)
      product.primarytargetrelatedjson = parseJson(product.target?.adPrimaryTargetRelatedTargetsJSON)?.at(0);
      const primarytargetrelatedjson =  parseJson(product.target?.adPrimaryTargetRelatedTargetsJSON);
      if(primarytargetrelatedjson) {
        let primarytargetname = [];
        primarytargetrelatedjson?.forEach((target) => {
          primarytargetname.push(target?.name);
        })
        product.target.primarytargetname = primarytargetname?.join(' ');
      }
      product.targetfunction = String(product.targetrelevance?.function?.join('. ') || '');
      product.targetposttranslationalmodifications = product.targetrelevance?.postTranslationalModifications?.join('. ');
      product.targetsequencesimilarities = product.targetrelevance?.sequenceSimilarities?.join('. ');
      product.targetattr = parseJson(product.raw.adsecondaryantibodyattributesjson);
      product.biochemicalattr = parseJson(product.raw.adbiochemicalattributesjson);
      if(product.biochemicalattr?.molecularFormula) {
        const mFormule = product.biochemicalattr.molecularFormula;
        product.biochemicalattr.molecularFormula = mFormule.replace(/\d/g, (digit) => `<sub>${digit}</sub>`);
      }
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
      product.notes?.forEach((note) => {
        note.statement = note.statement?.replace(/href="([^"]*?)"/gi, (match, hrefValue) => {
          const trimmedHref = hrefValue.trim();
          return `href="${trimmedHref}"`;
        });
        note.statement = note.statement?.replace(
            /<a\s+href="https?:\/\/www\.abcam\.com(\/[^"]*)"/gi, '<a href="$1"'
          );
        note.statement = note.statement?.replace(
          /<a\s([^>]*?href=")((?:\.\.\/)+|(?:\/))([^"?#]+)([^"]*)?"([^>]*)>/gi,
          (match, prefix, pathPrefix, path, query, rest) => {
            // Remove ../ segments and normalize path
            const cleanPath = path.replace(/^(\.\.\/)+/, '').replace(/^\//, '').toLowerCase();
            // Preserve query string if it exists
            const cleanQuery = query ? query.toLowerCase() : '';
            // Reconstruct the tag with modified href
            let link;
            if(product.locale) link = `<a ${prefix}/${locale}/${cleanPath}${cleanQuery}"${rest}>`;
            else link = `<a ${prefix}/${cleanPath}${cleanQuery}"${rest}>`
            return link;
          }
        );
      });
      product.images = parseJson(product.raw.imagesjson);      
      product.images?.forEach((image) =>{
        product.ogimage = `https://content.abcam.com/${image.imgSeoUrl}`;
        image.santizedTitle = sanitizeString(image.imgTitle);
        image.legend = image.imgLegend?.replace(/\r\n|\n|\r/g, '') || '';
        image.legend = image.legend?.replace(/"/g, '\\"');
        image.imagesusage = parseJson(image?.imgImageUsageJSON);
      })
      product.schemapurificationtechnique = product.raw.adpurificationtechnique || '' + ' ' + product.raw.adpurificationtechniquereagent || '';
      product.purity = product.raw.adpurity || product.raw.adpurificationfraction || undefined;
      product.purityassessment = product.raw.adpurityassessment || '';
      if(product.purityassessment){
        product.purity = product.purity + ' ' + product.purityassessment;
      }
      product.applications = parseJson(product.raw.adapplicationreactivityjson);
      product.tabledata = parseJson(product.raw.reactivitytabledata);
      product.summarynotes = parseJson(product.raw.adtargetsummarynotesjson);
      product.associatedproducts = parseJson(product.raw.adassociatedproductsjson);
      product.associatedproducts?.forEach((item) => {
        item.locale = product.locale;
        item.locale = product.host;
      })

      product.alternateproducts = parseJson(product.raw.addirectreplacementjson);
      if (product.alternateproducts) product.alternateproducts.type = product.alternateproducts?.seoClass?.levelOne;
      product.toprecommendedproducts = parseJson(product.raw.adtoprecommendedproductsjson);
      product.toprecommendedproducts?.forEach((toprecommendedproduct) => {
        if (toprecommendedproduct) {
          toprecommendedproduct.type = toprecommendedproduct?.seoClass?.levelOne;
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
      
      product.sequenceinfo = product.raw.adproteinaminoacidsequencesjson;
      const sequenceinfotag = product.raw.adproteinaminoacidsequencestags?.replace(/'/g, '"');
      product.sequenceinfotag = parseJson(sequenceinfotag);
      product.kitcomponent = parseJson(product.raw.adkitcomponentdetailsjson);
      product.immunogenlinkjson = parseJson(product.raw.adimmunogendatabaselinksjson)?.at(0);
      product.immunogendesc = product.raw.adimmunogendescription;
      product.relatedimmunogens = parseJson(product.raw.adrelatedimmunogensjson);
      product.purificationnotes = parseJson(product?.raw?.adpurificationnotesjson);
      product.purificationnotesstatement = product.purificationnotes?.map(note => note?.statement || '').join('\n');
      product.standardproteinisoforms = parseJson(product?.raw?.adstandardproteinisoformsjson)?.at(0);
      product.subcellularlocalisations = product.standardproteinisoforms?.subcellularLocalisations?.at(0);
      const pt = product?.raw?.adpurificationtechnique?.trim();
      const pr = product?.raw?.adpurificationtechniquereagent?.trim();
      if (pt && pr) {
        product.purificationtechnique = `${pt} ${pr}`;
      } else if (pt || pr) {
        product.purificationtechnique = pt || pr;
      } else {
        product.purificationtechnique = '';
      }
      product.conjugatevariations = parseJson(product?.raw?.advariationsjson);
      product.dissociationconstant = parseJson(product?.raw?.adantibodydissociationconstantjson);
      product.speciesreactivity = parseJson(product?.raw?.adspeciesreactivityjson);
      product.secondaryantibodytargetisotypes = product?.raw?.adsecondaryantibodyattributestargetisotypes?.split(';')?.join(', ') || '';
      product.productsummary = parseJson(product?.raw?.adproductsummaryjson);
      product.generalsummary = product.productsummary?.generalSummary || product.raw.adproductsummary;

      if(product.raw.adrelatedtargets){
        const stateLib = await State.init({});
        const filesLib = await Files.init({});
        product.relatedtargets = await getRelatedTargets(product.raw.adrelatedtargets, { stateLib, filesLib }, locale, logger);
      }
    }

    // load the templates
    const templateNames = [
      "page",
      "overview-section",
      "datasheet-section",
      "support-section",
      "product-header-block",
      "product-overview-block",
      "product-buybox-block",
      "product-variations-block",
      "product-keyfacts-block",
      "product-alternate-block",
      "product-publications-block",
      "product-target-block",
      "product-reactivity-block",
      "product-datasheet-block",
      "product-protocols-block",
      "product-promise-block",
      "product-storage-block",
      "product-notes-block",
      "product-summarynotes-block",
      "associated-products-block",
      "product-downloads-block",
      "product-sequenceinfo-block",
      "product-specifications-block",
      "product-general-info-block",
      "product-quality-control-block",
      "product-cell-culture-block",
      "product-handling-procedures-block",
      "product-precision-block",
      "product-recovery-block",
      "section-metadata-block",
      "product-kitcomponent-block",
      "product-header-inactive-block",
      "product-downloads-inactive-block",
      "product-unpublished-replacements-block",
      "meta-jsonld",
      "product-reactivity-jsonld"
  ];
    let template = '';
    templateNames.forEach((templateName) => {
      const templateContent = fs.readFileSync(
        `${dirname}/templates/us/${templateName}.html`,
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
