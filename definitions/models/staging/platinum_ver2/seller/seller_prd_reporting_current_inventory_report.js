

const model = new main.PlatinumModel(
    "seller_prd_reporting_current_inventory_report",
    {
        target_schema : "platinum_buymed_vn__stg", 
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
            clusterBy: ["warehouse_code","seller_code","sku"]
        }
    }
);
model.createIncremental(
    ["platinum_00h00","platinum_12h00","seller_prd_reporting"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
model.assertUnique(
    ["platinum_00h00","platinum_12h00", "seller_prd_reporting"],
    {
        intervalCheckpoint : `INTERVAL 1 YEAR`,
        maxRetry: 2
    }
)
model.createMismatchAssertionView(
    ["seller_prd_reporting"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        // dependencies : [model.dependencies.assertUnique]
    }
)
model.assertMismatch(
    ["platinum_00h00","platinum_12h00", "seller_prd_reporting"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)
