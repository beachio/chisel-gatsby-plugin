const Parse = require('parse/node');
const camelCase = require('camelcase')
const SITE_MODEL_NAME = 'Site';
const MODEL_MODEL_NAME = 'Model';
const MODEL_FIELD_MODEL_NAME = 'ModelField';
const MEDIA_ITEM_MODEL_NAME = 'MediaItem';



/**
 * ============================================================================
 * Helper functions and constants
 * ============================================================================
 */
// helper function for creating nodes
const createNodeFromData = (item, nodeType, helpers) => {
  const nodeMetadata = {
    id: helpers.createNodeId(`${nodeType}-${item.id}`),
    parent: null, // this is used if nodes are derived from other nodes, a little different than a foreign key relationship, more fitting for a transformer plugin that is changing the node
    children: [],
    internal: {
      type: nodeType,
      content: JSON.stringify(item),
      contentDigest: helpers.createContentDigest(item),
    },
  }

  const node = Object.assign({}, item, nodeMetadata)
  helpers.createNode(node)
  return node
}

/**
 * ============================================================================
 * Verify plugin loads
 * ============================================================================
 */

// should see message in console when running `gatsby develop` in example-site
exports.onPreInit = () => console.log("Loaded source-plugin")

/**
 * ============================================================================
 * Source and cache nodes from the API
 * ============================================================================
 */

exports.sourceNodes = async function sourceNodes(
  {
    actions,
    cache,
    createContentDigest,
    createNodeId,
    getNodesByType,
    getNode,
  },
  pluginOptions
) {
  const helpers = Object.assign({}, actions, {
    createContentDigest,
    createNodeId,
  })

  // Parse initialization with pluginOptions variable
  Parse.initialize(pluginOptions.appId, null, pluginOptions.masterKey);
  Parse.serverURL = pluginOptions.serverURL;
  Parse.Cloud.useMasterKey();

  // Special handling for MediaItem
  await appendMediaItems(helpers);  

  // Get available content types from models
  const modelsArray = await getContentTypes(pluginOptions);

  for (const model of modelsArray) {
    const { typeName, tableName, fields } = model;
    
    const query = new Parse.Query(tableName);
    query.equalTo('t__status', 'Published');
    const entries = await query.find();
    const collection = [];
    for (const entry of entries) {
      const node = {}
      node.id = entry.id;
      node.title = entry.get('Title');
      node.date = entry.get('createdAt');
      node.createdAt = entry.get('createdAt');
      node.updatedAt = entry.get('updatedAt');
      collection.push(node);
      for (const field of fields) {
        if (field.type === 'Reference') {
          // List of References
          if (field.isList) {
            const values = getFieldValue(entry, field);
            if (values) {
              values.forEach((value) => {
                const foreignTypeName = getTypenameFromClassname(value.className, modelsArray);
                if (!foreignTypeName) return;
                if (!node[`${field.nameid}___NODE`]) node[`${field.nameId}___NODE`] = [];
                node[`${field.nameId}___NODE`].push(createNodeId(`${foreignTypeName}-${value.id}`));
              });
            }
          } else {
            // Single Reference
            const fieldValue = getFieldValue(entry, field);
            if (fieldValue) {
              const foreignTypeName = getTypenameFromClassname(fieldValue.className, modelsArray);
              if (foreignTypeName) node[`${field.nameId}___NODE`] = createNodeId(`${foreignTypeName}-${fieldValue.id}`); 
            }
          }
        } else if (field.type === 'Media') {
          if (field.isList) {
            const values = getFieldValue(entry, field);
            values.forEach((value) => {
              if (!node[`${field.nameid}___NODE`]) node[`${field.nameId}___NODE`] = [];
              node[`${field.nameId}___NODE`].push(createNodeId(`MediaItem-${value.id}`));
            });
          } else {
            const fieldValue = getFieldValue(entry, field);
            if (fieldValue) node[`${field.nameId}___NODE`] = createNodeId(`MediaItem-${fieldValue.id}`); 
          }
        } else// Common Values
          node[field.nameId] = getFieldValue(entry, field);
      }
    }

    collection.forEach(item => 
      createNodeFromData(item, typeName, helpers)
    );
  }

  return
}


/* 
*
* Parse related helper functions: Chisel specific
*
*/
// Core method
// Get the list of available content types to map
const getContentTypes = async (pluginOptions) => {
  const ModelModel = Parse.Object.extend(MODEL_MODEL_NAME);
  const SiteModel = Parse.Object.extend(SITE_MODEL_NAME);

  const modelQuery = new Parse.Query(ModelModel);
  modelQuery.equalTo('site', new SiteModel({id: pluginOptions.siteId}));
  const models = await modelQuery.find();

  const modelsArray = await Promise.all(
    models.map(async modelRecord => {
      // model meta info and register
      const name = modelRecord.get('nameId');
      const typeName = createTypeName(name, pluginOptions)

      const fields = await prepareFieldsDefinition(modelRecord);

      return {
        name,
        typeName,
        id: modelRecord.id,
        tableName: modelRecord.get('tableName'),
        fields
      }
    })
  );

  return modelsArray;
}


// Prepare model fields definition based on ModelField Class
// called from getContentTypes
const prepareFieldsDefinition = async (modelRecord) => {
  const ModelFieldModel = Parse.Object.extend(MODEL_FIELD_MODEL_NAME);
  const modelFieldQuery = new Parse.Query(ModelFieldModel);
  modelFieldQuery.equalTo('model', modelRecord);
  modelFieldQuery.equalTo('isDisabled', false);
  const modelFields = await modelFieldQuery.find();

  if (modelFields && modelFields.length < 1) return null;

  const fields = modelFields.map(modelFieldRecord => (
    {
      nameId: modelFieldRecord.get('nameId'),
      name: modelFieldRecord.get('name'),
      isList: modelFieldRecord.get('isList'),
      type: modelFieldRecord.get('type')
    }
  ));

  return fields;
}


const createTypeName = (name = '', pluginOptions) => {
  return camelCase(`${pluginOptions.typeName} ${name}`, { pascalCase: true })
}

// Get field value for getEntries core method
const getFieldValue = (entry, field, store) => {
  try {
    const key = field.nameId;
    const value = entry.get(key);
    return value;
  } catch (error) {
    console.log("error while getFieldValue value/error", field, error);
    return null;
  }
}


// Get Typename from className
// className: ct____XXXX____Challenge => typeName: Challenge
const getTypenameFromClassname = (className, modelsArray) => {
  const model = modelsArray.find(m => m.tableName === className);
  return model ? model.typeName : null;
}


const appendMediaItems = async (helpers) => {
  const query = new Parse.Query(MEDIA_ITEM_MODEL_NAME);
  const entries = await query.find();
  const collection = [];
  for (const entry of entries) {
    const node = {}
    node.id = entry.id;
    node.title = entry.get('Title');
    node.date = entry.get('createdAt');
    node.createdAt = entry.get('createdAt');
    node.updatedAt = entry.get('updatedAt');
    console.log("Media Item", entry.get('file'));
    if (entry.get('file')) node.url = entry.get('file')._url;
    collection.push(node);
  }

  collection.forEach(item => 
    createNodeFromData(item, 'MediaItem', helpers)
  );
}