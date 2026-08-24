
const model = new main.PlatinumModel(
    "reconciliation_recon_line",
    {
        target_schema : "platinum_buymed_vn__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
        }
    }
);
model.createIncremental(
    ["platinum_0h00","platinum_12h00", "platinum_staging", "reconciliation_recon_line"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
// model.assertUnique(
//     ["platinum_0h00","platinum_12h00", "platinum_unique_assertion", "delivery_prd_transporting"],
//     {
//         intervalCheckpoint : `INTERVAL 1 YEAR`,
//         maxRetry: 2,
//         dependencies: [{schema:"platinum_buymed_vn",name:"delivery_prd_transporting_hub_shipping_order"}]
//     }
// )
// model.createMismatchAssertionView(
//     ["platinum_staging_assertion_view", "delivery_prd_transporting"],
//     {
//         intervalCheckpoint: `INTERVAL 2 DAY`,
//         maxRetry: 2,
//         // dependencies : [model.dependencies.assertUnique]
//     }
// )
// model.assertMismatch(
//     ["platinum_0h00","platinum_12h00", "platinum_staging_assertion", "delivery_prd_transporting"],
//     {
//         intervalCheckpoint: `INTERVAL 2 DAY`,
//         maxRetry: 2,
        
//     }
// )