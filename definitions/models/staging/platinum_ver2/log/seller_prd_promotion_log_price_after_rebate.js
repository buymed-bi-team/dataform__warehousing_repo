
const model = new main.PlatinumModel(
    "seller_prd_promotion_log_price_after_rebate",
    {
        target_schema : "platinum_buymed_vn__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
            clusterBy: ["vendor_code", "warehouse_code","product_code","version"]
        }
    }
);
model.createIncremental(
    ["0h00","12h00", "platinum_staging", "seller_prd_promotion_log"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
model.assertUnique(
    ["0h00", "platinum_unique_assertion", "seller_prd_promotion_log"],
    {
        intervalCheckpoint : `INTERVAL 1 YEAR`,
        dependencies : [{schema:"platinum_buymed_vn",name:"seller_prd_promotion_log_price_after_rebate"}],
        maxRetry: 1
    }
)
model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "seller_prd_promotion_log"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 1,
        // dependencies : [model.dependencies.assertUnique]
    }
)
model.assertMismatch(
    ["0h00", "platinum_staging_assertion", "seller_prd_promotion_log"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 1,
        
    }
)