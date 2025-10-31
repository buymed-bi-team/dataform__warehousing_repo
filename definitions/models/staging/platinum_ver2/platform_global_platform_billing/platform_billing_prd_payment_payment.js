const model = new main.PlatinumModel(
    "platform_billing_prd_payment_payment",
    {
        target_schema : "platinum_buymed_vn_restricted__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        source_schema : source.silver_restricted,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
            clusterBy: ["payment_code","partner_type","status","company_code"]
        }
    }
);
model.createIncremental(
    ["platinum_0h00","platinum_12h00", "platinum_staging", "platform_billing_prd_payment"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
model.assertUnique(
    ["platinum_0h00","platinum_12h00", "platinum_unique_assertion", "platform_billing_prd_payment"],
    {
        intervalCheckpoint : `INTERVAL 1 YEAR`,
        maxRetry: 2,
        dependencies : [{schema:"platinum_buymed_vn_restricted",name:"platform_billing_prd_payment_payment"}]
    }
)
model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "platform_billing_prd_payment"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        // dependencies : [model.dependencies.assertUnique]
    }
)
model.assertMismatch(
    ["platinum_0h00","platinum_12h00", "platinum_staging_assertion", "platform_billing_prd_payment"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)