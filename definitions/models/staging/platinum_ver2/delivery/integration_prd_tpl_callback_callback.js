
const model = new main.PlatinumModel(
    "integration_prd_tpl_callback_callback",
    {
        target_schema : "platinum_buymed_vn__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : false,
        bigquery: {
            partitionBy: "created_date",
            clusterBy: ["status","ingest_time"]
        }
    }
);
model.createIncremental(
    ["platinum_00h00","platinum_12h00", "platinum_staging", "integration_prd_tpl-callback"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
model.assertUnique(
    ["platinum_00h00","platinum_12h00", "platinum_unique_assertion", "integration_prd_tpl-callback"],
    {
        intervalCheckpoint : `INTERVAL 1 YEAR`,
        maxRetry: 2
    }
)
model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "integration_prd_tpl-callback"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        // dependencies : [model.dependencies.assertUnique]
    }
)
model.assertMismatch(
    ["platinum_00h00","platinum_12h00", "platinum_staging_assertion", "integration_prd_tpl-callback"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)