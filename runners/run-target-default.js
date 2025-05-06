require('dotenv').config();
const { main } = require('../actions/check-target-changes/index');
const { Core } = require('@adobe/aio-sdk');
const { generateTargetHtml } = require('../actions/target-renderer/render');

(async () => {
    try {
        const product = {
            "title": "pcna_(TGT1229)",
            "uri": "targetfamily://tgt1229/",
            "printableUri": "targetfamily://tgt1229/",
            "clickUri": "targetfamily://tgt1229/",
            "uniqueId": "42.47575$targetfamily://tgt1229/",
            "excerpt": "\"targetfamily://TGT1229\"",
            "firstSentences": null,
            "summary": null,
            "flags": "HasHtmlVersion;SkipSentencesScoring;HasAllMetaDataStream",
            "hasHtmlVersion": true,
            "hasMobileHtmlVersion": false,
            "score": 1517,
            "percentScore": 87.64139,
            "rankingInfo": null,
            "rating": 0.0,
            "isTopResult": false,
            "isRecommendation": false,
            "isUserActionView": false,
            "titleHighlights": [],
            "firstSentencesHighlights": [],
            "excerptHighlights": [],
            "printableUriHighlights": [],
            "summaryHighlights": [],
            "parentResult": null,
            "childResults": [],
            "totalNumberOfChildResults": 0,
            "absentTerms": [],
            "raw": {
                "tgttargetgroupingalternativenames": "Proliferating cell nuclear antigen|PCNA|Cyclin",
                "tgtlinkeddatasourcejson": "[\n  {\n    \"label\": \"P12004\",\n    \"type\": \"swissprot\",\n    \"value\": \"https://www.uniprot.org/uniprot/P12004\"\n  },\n  {\n    \"label\": \"176740\",\n    \"type\": \"omim\",\n    \"value\": \"http://www.ncbi.nlm.nih.gov/omim/176740\"\n  },\n  {\n    \"label\": \"5111\",\n    \"type\": \"entrezGene\",\n    \"value\": \"http://www.ncbi.nlm.nih.gov/entrez/query.fcgi?db=gene&cmd=Retrieve&dopt=Graphics&list_uids=5111\"\n  }\n]",
                "systitle": "pcna_(TGT1229)",
                "sysurihash": "Y8bgt9GZñ8NRayY8",
                "inriverentityid": "8590",
                "urihash": "Y8bgt9GZñ8NRayY8",
                "tgttargetgroupingslug": "pcna",
                "sysuri": "targetfamily://tgt1229/",
                "targetfamilyid": "TGT1229",
                "systransactionid": 354135,
                "tgttargetgroupingname": "PCNA",
                "tgtisofromaccessionvalue": "https://www.uniprot.org/uniprot/P12004-1",
                "tgtisofromaccessionlabel": "P12004-1",
                "tgtnumber": "TGT1229",
                "mappingtype": "TargetFamily",
                "sysindexeddate": 1745515655000,
                "permanentid": "d0daed24c3e256f609f4f8b076ed5725ccae4abde631f1a9d39e206e37ba",
                "tgtalternativenames": "Proliferating cell nuclear antigen|PCNA|Cyclin",
                "opco": "Abcam",
                "tgtisofromaccessiontype": "swissprot",
                "transactionid": 354135,
                "title": "pcna_(TGT1229)",
                "date": 1745515654000,
                "objecttype": "TargetFamily",
                "tgtslug": "pcna",
                "rowid": 1745515654758566991,
                "tgtname": "PCNA",
                "size": 24,
                "tgtresearchareas": "Immunology & Infectious Disease",
                "detectedtitle": "\"targetfamily://TGT1229\"",
                "urlpath": "/targets/pcna/tgt1229",
                "syssource": "Abcam Catalog Stage",
                "orderingid": 1745515652608,
                "syssize": 24,
                "sysdate": 1745515654000,
                "tgttype": "Proteins",
                "primaryid": "LE4GEZ3UHFDVVQ5RHBHFEYLZLE4C4NBXGU3TKLTEMVTGC5LMOQ",
                "tgtmolecularweight": "28769Da",
                "wordcount": 2,
                "sku": "pcna",
                "source": "Abcam Catalog Stage",
                "collection": "default",
                "tgtrelevancejson": "{\n  \"cellularLocalization\": [\n    \"\",\n    \"Nucleus\",\n    \"Colocalizes with CREBBP, EP300 and POLD1 to sites of DNA damage (PubMed:24939902). Forms nuclear foci representing sites of ongoing DNA replication and vary in morphology and number during S phase (PubMed:15543136). Co-localizes with SMARCA5/SNF2H and BAZ1B/WSTF at replication foci during S phase (PubMed:15543136). Together with APEX2, is redistributed in discrete nuclear foci in presence of oxidative DNA damaging agents.\"\n  ],\n  \"domain\": [\n    \n  ],\n  \"developmentalStage\": [\n    \n  ],\n  \"function\": [\n    \"Auxiliary protein of DNA polymerase delta and epsilon, is involved in the control of eukaryotic DNA replication by increasing the polymerase's processibility during elongation of the leading strand (PubMed:35585232). Induces a robust stimulatory effect on the 3'-5' exonuclease and 3'-phosphodiesterase, but not apurinic-apyrimidinic (AP) endonuclease, APEX2 activities. Has to be loaded onto DNA in order to be able to stimulate APEX2. Plays a key role in DNA damage response (DDR) by being conveniently positioned at the replication fork to coordinate DNA replication with DNA repair and DNA damage tolerance pathways (PubMed:24939902). Acts as a loading platform to recruit DDR proteins that allow completion of DNA replication after DNA damage and promote postreplication repair: Monoubiquitinated PCNA leads to recruitment of translesion (TLS) polymerases, while 'Lys-63'-linked polyubiquitination of PCNA is involved in error-free pathway and employs recombination mechanisms to synthesize across the lesion (PubMed:24695737).\"\n  ],\n  \"involvementInDisease\": [\n    \"\",\n    \"Ataxia-telangiectasia-like disorder 2\",\n    \"ATLD2\",\n    \"A neurodegenerative disorder due to defects in DNA excision repair. ATLD2 is characterized by developmental delay, ataxia, sensorineural hearing loss, short stature, cutaneous and ocular telangiectasia, and photosensitivity.\",\n    \"None\",\n    \"The disease is caused by variants affecting the gene represented in this entry.\"\n  ],\n  \"pathway\": [\n    \n  ],\n  \"postTranslationalModifications\": [\n    \"Phosphorylated. Phosphorylation at Tyr-211 by EGFR stabilizes chromatin-associated PCNA.\",\n    \"Acetylated by CREBBP and p300/EP300; preferentially acetylated by CREBBP on Lys-80, Lys-13 and Lys-14 and on Lys-77 by p300/EP300 upon loading on chromatin in response to UV irradiation (PubMed:19419956, PubMed:24939902). Lysine acetylation disrupts association with chromatin, hence promoting PCNA ubiquitination and proteasomal degradation in response to UV damage in a CREBBP- and EP300-dependent manner (PubMed:24939902). Acetylation disrupts interaction with NUDT15 and promotes degradation (PubMed:19419956).\",\n    \"Ubiquitinated (PubMed:20227374, PubMed:24939902). Following DNA damage, can be either monoubiquitinated to stimulate direct bypass of DNA lesions by specialized DNA polymerases or polyubiquitinated to promote recombination-dependent DNA synthesis across DNA lesions by template switching mechanisms. Following induction of replication stress, monoubiquitinated by the UBE2B-RAD18 complex on Lys-164, leading to recruit translesion (TLS) polymerases, which are able to synthesize across DNA lesions in a potentially error-prone manner. An error-free pathway also exists and requires non-canonical polyubiquitination on Lys-164 through 'Lys-63' linkage of ubiquitin moieties by the E2 complex UBE2N-UBE2V2 and the E3 ligases, HLTF, RNF8 and SHPRH. This error-free pathway, also known as template switching, employs recombination mechanisms to synthesize across the lesion, using as a template the undamaged, newly synthesized strand of the sister chromatid. Monoubiquitination at Lys-164 also takes place in undamaged proliferating cells, and is mediated by the DCX(DTL) complex, leading to enhance PCNA-dependent translesion DNA synthesis. Sumoylated during S phase.\",\n    \"Methylated on glutamate residues by ARMT1/C6orf211.\"\n  ],\n  \"sequenceSimilarities\": [\n    \"Belongs to the PCNA family.\"\n  ],\n  \"tissueSpecificity\": [\n    \n  ]\n}",
                "indexeddate": 1745515655000,
                "filetype": "txt",
                "sysfiletype": "txt",
                "sysrowid": 1745515654758566991,
                "uri": "targetfamily://tgt1229/",
                "syscollection": "default"
            },
            "Title": "pcna_(TGT1229)",
            "Uri": "targetfamily://tgt1229/",
            "PrintableUri": "targetfamily://tgt1229/",
            "ClickUri": "targetfamily://tgt1229/",
            "UniqueId": "42.47575$targetfamily://tgt1229/",
            "Excerpt": "\"targetfamily://TGT1229\"",
            "FirstSentences": null
        };
        const logger = Core.Logger('main', { level: 'info' })
        logger.info(generateTargetHtml(product, {logger}));
    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        console.log(new Date().toISOString(), 'Finishing the action');
    }
})();
