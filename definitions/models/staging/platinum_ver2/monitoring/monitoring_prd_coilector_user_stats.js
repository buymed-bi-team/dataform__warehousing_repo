
const model = new main.PlatinumModel(
    "monitoring_prd_collector_user_stats",
    {
        target_schema : "platinum_buymed_vn__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : false,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
            clusterBy: ["event, customer_id, mg_id"]
        }
    }
);
model.createIncremental(
    ["0h00","12h00", "platinum_staging", "monitoring_prd_collector"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
model.assertUnique(
    ["0h00","12h00", "platinum_unique_assertion", "monitoring_prd_collector"],
    {
        intervalCheckpoint : `INTERVAL 1 YEAR`,
        maxRetry: 2
    }
)
model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "monitoring_prd_collector"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        // dependencies : [model.dependencies.assertUnique]
    }
)
model.assertMismatch(
    ["0h00","12h00", "platinum_staging_assertion", "monitoring_prd_collector"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)