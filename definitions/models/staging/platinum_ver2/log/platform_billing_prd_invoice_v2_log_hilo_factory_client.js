
const model = new main.PlatinumModel(
    "platform_billing_prd_invoice_v2_log_hilo_factory_client",
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
    ["platinum_0h00","platinum_12h00", "platinum_staging", "platform_billing_prd_invoice-v2_log"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
model.assertUnique(
    ["platinum_0h00","platinum_12h00", "platinum_unique_assertion", "platform_billing_prd_invoice-v2_log"],
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
    ["platinum_0h00","platinum_12h00", "platinum_staging_assertion", "platform_billing_prd_invoice-v2_log"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)