
const model = new main.PlatinumModel(
    "marketplace_prd_order_v2_order",
    {
        target_schema : "platinum_buymed_vn__stg", // Use for document
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
    ["platinum_00h00", "platinum_07h00","platinum_12h00","platinum_19h00", "platinum_staging", "marketplace_prd_order-v2","Finance/margin"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
model.assertUnique(
    ["platinum_00h00", "platinum_07h00","platinum_12h00","platinum_19h00", "platinum_unique_assertion", "marketplace_prd_order-v2","Finance/margin"],
    {
        intervalCheckpoint : `INTERVAL 1 YEAR`,
        maxRetry: 2
    }
)
model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "marketplace_prd_order-v2","Finance/margin"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        // dependencies : [model.dependencies.assertUnique]
    }
)
model.assertMismatch(
    ["platinum_00h00", "platinum_07h00","platinum_12h00","platinum_19h00", "platinum_staging_assertion", "marketplace_prd_order-v2","Finance/margin"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)