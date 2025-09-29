const model = new main.PlatinumModel(
    "platform_accounting_prd_debt_debt",
    {
        target_schema : "platinum_buymed_vn_restricted__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        source_schema : source.silver_restricted,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date"
        }
    }
);
model.createIncremental(
    ["platinum_0h00","platinum_12h00", "platinum_staging", "platform_accounting_prd_debt"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
model.assertUnique(
    ["platinum_0h00","platinum_12h00", "platinum_unique_assertion", "platform_accounting_prd_debt"],
    {
        intervalCheckpoint : `INTERVAL 1 YEAR`,
        maxRetry: 2
    }
)
model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "platform_accounting_prd_debt"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        // dependencies : [model.dependencies.assertUnique]
    }
)
model.assertMismatch(
    ["platinum_0h00","platinum_12h00", "platinum_staging_assertion", "platform_accounting_prd_debt"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)