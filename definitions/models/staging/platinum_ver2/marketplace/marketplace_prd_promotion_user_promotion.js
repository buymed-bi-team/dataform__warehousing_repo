
const model = new main.PlatinumModel(
    "marketplace_prd_promotion_user_promotion",
    {
        target_schema : "platinum_buymed_vn__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
            clusterBy: ["status"]
        }
    }
);
model.createIncremental(
    ["platinum_custom_1h", "platinum_staging", "marketplace_prd_promotion"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 DAY"
    }
);
model.assertUnique(
    ["0h00","12h00", "platinum_unique_assertion", "marketplace_prd_promotion"],
    {
        intervalCheckpoint : `INTERVAL 3 MONTH`,
        maxRetry: 2
    }
)
model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "marketplace_prd_promotion"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        // dependencies : [model.dependencies.assertUnique]
    }
)
model.assertMismatch(
    ["0h00","12h00", "platinum_staging_assertion", "marketplace_prd_promotion"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)