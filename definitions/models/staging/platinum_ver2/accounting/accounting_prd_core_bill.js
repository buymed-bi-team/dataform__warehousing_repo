const model = new main.PlatinumModel(
    "accounting_prd_core_bill",
    {
        target_schema : "platinum_buymed_vn__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
            clusterBy: ["status"]
        }
    }
);
model.createIncremental(
    ["platinum_0h00","platinum_12h00", "platinum_staging", "accounting_prd_core"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
model.assertUnique(
    ["platinum_0h00","platinum_12h00", "platinum_unique_assertion", "accounting_prd_core"],
    {
        intervalCheckpoint : `INTERVAL 1 YEAR`,
        maxRetry: 2,
        dependencies: [{schema:"platinum_buymed_vn",name:"accounting_prd_core_bill"}]
    }
)
model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "accounting_prd_core"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        // dependencies : [model.dependencies.assertUnique]
    }
)
model.assertMismatch(
    ["platinum_0h00","platinum_12h00", "platinum_staging_assertion", "accounting_prd_core"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)