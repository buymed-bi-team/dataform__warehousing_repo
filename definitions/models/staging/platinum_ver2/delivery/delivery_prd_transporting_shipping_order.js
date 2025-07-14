
const model = new main.PlatinumModel(
    "delivery_prd_transporting_shipping_order",
    {
        target_schema : "platinum_buymed_vn__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
            clusterBy: ["type"]
        }
    }
);
model.createIncremental(
    ["0h00","12h00", "platinum_staging", "platform_billing_prd_invoice-v2_log"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
model.assertUnique(
    ["0h00","12h00", "platinum_unique_assertion", "platform_billing_prd_invoice-v2_log"],
    {
        intervalCheckpoint : `INTERVAL 1 YEAR`,
        maxRetry: 2
    }
)
model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "platform_billing_prd_invoice-v2_log"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        // dependencies : [model.dependencies.assertUnique]
    }
)
model.assertMismatch(
    ["0h00","12h00", "platinum_staging_assertion", "platform_billing_prd_invoice-v2_log"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)