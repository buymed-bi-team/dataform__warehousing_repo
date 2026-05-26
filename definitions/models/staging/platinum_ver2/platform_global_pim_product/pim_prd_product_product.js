
const model = new main.PlatinumModel(
    "pim_prd_product_product",
    {
        target_schema : "platinum_buymed_vn__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : false,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
            // clusterBy: []
        }
    }
);
model.createIncremental(
    ["platinum_0h00","platinum_12h00", "platinum_staging", "pim_prd_product"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 2 HOUR"
    }
);
model.assertUnique(
    ["platinum_0h00","platinum_12h00", "platinum_unique_assertion", "pim_prd_product"],
    {
        intervalCheckpoint : `INTERVAL 2 DAY`,
        maxRetry: 2
    }
)
model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "pim_prd_product"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        dependencies : [{schema:"platinum_buymed_vn",name:"pim_prd_product_product"}]
    }
)
model.assertMismatch(
    ["platinum_0h00","platinum_12h00", "platinum_staging_assertion", "pim_prd_product"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)