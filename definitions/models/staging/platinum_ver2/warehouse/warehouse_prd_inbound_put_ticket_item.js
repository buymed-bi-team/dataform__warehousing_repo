const model = new main.PlatinumModel(
    "warehouse_prd_inbound_put_ticket_item",
    {
        target_schema : "platinum_buymed_vn__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
            clusterBy: ["put_code","ticket_id","seller_code","warehouse_code"]
        }
    }
);
model.createIncremental(
    ["platinum_0h00","platinum_12h00", "platinum_staging", "warehouse_prd_inbound"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
model.assertUnique(
    ["platinum_0h00","platinum_12h00", "platinum_unique_assertion", "warehouse_prd_inbound"],
    {
        intervalCheckpoint : `INTERVAL 1 YEAR`,
        maxRetry: 2,
        dependencies : [{schema:"platinum_buymed_vn",name:"warehouse_prd_inbound_put_ticket_item"}]
    }
)
model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "warehouse_prd_inbound"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2
    }
)
model.assertMismatch(
    ["platinum_0h00","platinum_12h00", "platinum_staging_assertion", "warehouse_prd_inbound"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)