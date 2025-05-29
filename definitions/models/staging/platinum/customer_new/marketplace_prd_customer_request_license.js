

const model = new main.PlatinumModel(
    "marketplace_prd_customer_request_license",
    {
        target_schema : "platinum_buymed_vn", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date"
        }
    }
);
model.createIncremental(
    ["platinum_custom_1h_past7", "marketplace_prd_customer"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 2 HOUR"
    }
);
model.assertUnique(
    ["platinum_custom_1h_past7",  "marketplace_prd_customer"],
    {
        intervalCheckpoint : `INTERVAL 1 YEAR`,
        maxRetry: 2
    }
)
model.createMismatchAssertionView(
    [  "marketplace_prd_customer"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        // dependencies : [model.dependencies.assertUnique]
    }
)
model.assertMismatch(
    ["platinum_custom_1h_past7",  "marketplace_prd_customer"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)