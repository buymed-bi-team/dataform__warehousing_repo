
const model = new main.PlatinumModel(
    "warehouse_prd_inventory_sku",
    {
        target_schema : "platinum_buymed_vn__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
            clusterBy: ["warehouse_code","status"]
        }
    }
);
model.createIncremental(
    ["platinum_custom_10min", "platinum_staging", "warehouse_prd_inventory"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 2 HOUR"
    }
);
model.assertUnique(
    ["0h00","12h00", "platinum_unique_assertion", "warehouse_prd_inventory"],
    {
        intervalCheckpoint : `INTERVAL 2 DAY`,
        maxRetry: 2
    }
)
model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "warehouse_prd_inventory"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        // dependencies : [model.dependencies.assertUnique]
    }
)
model.assertMismatch(
    ["0h00","12h00", "platinum_staging_assertion", "warehouse_prd_inventory"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)