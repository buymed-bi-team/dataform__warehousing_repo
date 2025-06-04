const { createIncremental } = require('./create_incremental.js');
const { assertUnique } = require('./assert_unique.js');
const { createMismatchAssertionView } = require('./create_mismatch_assertion_view.js');
const { assertMismatch } = require('./assert_mismatch.js');

class PlatinumModel {
    constructor(
        tableName,
        {
            target_schema = ``,
            source_schema = ``,
            description = ``,
            is_protected = false,
            bigquery = {},
            customAssertionsSchema = ``,
            prefixCustomAssertionsName = ``,
            has_lastUpdatedTime = true,
            has_createdTime = true,
        } = {}
    ) {
        // Initialize config with all properties
        this.config = {
            tableName: tableName,
            target_schema: target_schema || dataform.projectConfig.defaultSchema,
            source_schema: source_schema || source.silver, //(source.silver.includes('.') ? source.silver.split('.')[1] : source.silver),
            description: description,
            is_protected : is_protected,
            bigquery : bigquery,
            customAssertionsSchema: customAssertionsSchema || dataform.projectConfig.assertionSchema,
            prefixCustomAssertionsName: prefixCustomAssertionsName || `${target_schema || dataform.projectConfig.defaultSchema }__`,
            createdTime: has_createdTime ? 'created_time' : 'silver_buymed_vn.MONGOID_TIMESTAMP(mg_id)',
            lastUpdatedTime: has_lastUpdatedTime ? 'last_updated_time' : 'CURRENT_TIMESTAMP()'
        };
        this.dependencies = {};
    }

    createIncremental(
        tags,
        {
            has_src_created_date = false,
            assertions = {},
            ingestCutOffInterval = ``,
            disabled = false,
        } = {}
    ) {
        createIncremental({
            config: this.config,
            has_src_created_date,
            tags,
            assertions,
            ingestCutOffInterval,
            disabled
        });
        this.config.has_src_created_date = has_src_created_date
    }

    assertUnique(
        tags,
        {
            assertionName = ``,
            customAssertionsSchema = ``,
            bigquery = {},
            disabled = false,
            dependencies = [],
            intervalCheckpoint = `` ,  // example interval_dateRange = `INTERVAL 1 MONTH` // For mkp_order_item
            maxRetry = 2,
        } = {}
    ) {
        let newConfig = this.config 
        newConfig.customAssertionsSchema = customAssertionsSchema || newConfig.customAssertionsSchema
        assertionName = assertionName || `${newConfig.prefixCustomAssertionsName}${newConfig.tableName}__assert_unique`
        assertUnique({
            config: newConfig,
            tags,
            assertionName,
            bigquery,
            dependencies,
            intervalCheckpoint,
            disabled,
            maxRetry
        })
        this.dependencies.assertUnique = {
            "schema": newConfig.customAssertionsSchema,
            "name" : assertionName
        }
    }

    createMismatchAssertionView(
        tags,
        {
            assertionName = ``,
            customAssertionsSchema = ``,
            bigquery = {},
            disabled = false,
            dependencies = [],
            intervalCheckpoint = `interval 2 DAY`,
        } = {}
    ) {
        let newConfig = this.config 
        newConfig.customAssertionsSchema = customAssertionsSchema || newConfig.customAssertionsSchema

        assertionName = assertionName || `${newConfig.prefixCustomAssertionsName}${newConfig.tableName}__assert_mismatch_view` 
        createMismatchAssertionView({
            config: newConfig,
            tags,
            assertionName ,
            bigquery,
            disabled,
            dependencies,
            intervalCheckpoint,
        });
        this.dependencies.createMismatchAssertionView = {
            "schema": newConfig.customAssertionsSchema,
            "name" : assertionName
        }
        
    }

    assertMismatch(
        tags,
        {
            assertionName = ``,
            dependencyViewName = ``,
            customAssertionsSchema = ``,
            bigquery = {},
            disabled = false,
            dependencies = [],
            maxRetry = 2,
        } = {}
    ) {
        let newConfig = this.config 
        newConfig.customAssertionsSchema = customAssertionsSchema || newConfig.customAssertionsSchema
        assertionName = assertionName || `${newConfig.prefixCustomAssertionsName}${newConfig.tableName}__assert_mismatch_operations`
        dependencyViewName = dependencyViewName || `${newConfig.prefixCustomAssertionsName}${newConfig.tableName}__assert_mismatch_view`
        const exists = dependencies.some(
            dep => dep.schema === newConfig.customAssertionsSchema && dep.name === dependencyViewName
        )

        if (!exists) {
            dependencies.push({ "schema": newConfig.customAssertionsSchema, "name": dependencyViewName });
        }
        assertMismatch({
            config : newConfig,
            tags,
            assertionName ,
            dependencyViewName,
            disabled,
            dependencies,
            bigquery,
            maxRetry,
        });
        this.dependencies.assertMismatch = {
            "schema": newConfig.customAssertionsSchema,
            "name" : assertionName
        }
    }

    // // Convenience method to create all components at once
    // createModel(
    //     tags,
    //     {
    //         source_schema = source.silver,
    //         assertions = {},
    //         bigquery = {},
    //         ingestCutOffInterval = ``,
    //         schema = "dataform_assertions",
    //         interval_dateRange = ``,
    //         start_timestamp = `current_timestamp() - interval 2 DAY`,
    //         retry_cnt = 2,
    //         assert_checkpoint_start_time = `DATE("2001-01-01")`,
    //     } = {}
    // ) {
    //     this.createIncremental(tags, { source_schema, assertions, bigquery, ingestCutOffInterval });
    //     this.assertUnique(tags, { schema, interval_dateRange });
    //     this.createMismatchAssertionView(tags, { source_schema, schema, start_timestamp });
    //     this.assertMismatch(tags, { retry_cnt, assert_checkpoint_start_time, source_schema });
    //     return this;
    // }
}

module.exports = { PlatinumModel  };