const model = new main.PlatinumModel(
    "seller_prd_purchasing_vendor_bill_item",
    {
        target_schema : "platinum_buymed_vn__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
            clusterBy: ["vendor_bill_id","po_code","product_id","seller_code"]
        }
    }
);
model.createIncremental(
    ["platinum_0h00","platinum_12h00", "platinum_staging", "seller_prd_purchasing", "Finance/margin"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
model.assertUnique(
    ["platinum_0h00","platinum_12h00", "platinum_unique_assertion", "seller_prd_purchasing"],
    {
        intervalCheckpoint : `INTERVAL 1 YEAR`,
        maxRetry: 2,
        dependencies: [{schema:"platinum_buymed_vn",name:"seller_prd_purchasing_vendor_bill_item"}]
    }
)
model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "seller_prd_purchasing"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        // dependencies : [model.dependencies.assertUnique]
    }
)
model.assertMismatch(
    ["platinum_0h00","platinum_12h00", "platinum_staging_assertion", "seller_prd_purchasing"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)