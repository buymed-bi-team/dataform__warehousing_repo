
const model = new main.PlatinumModel(
    "monitoring_prd_realtime_user_user_range",
    {
        target_schema : "platinum_buymed_vn__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
            clusterBy: ["day_str, hour_from_str, user_id"]
        }
    }
);
model.createIncremental(
    ["0h00","12h00", "platinum_staging", "monitoring_prd_realtime-user"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
model.assertUnique(
    ["0h00","12h00", "platinum_unique_assertion", "monitoring_prd_realtime-user"],
    {
        intervalCheckpoint : `INTERVAL 1 YEAR`,
        maxRetry: 2
    }
)
model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "monitoring_prd_realtime-user"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        // dependencies : [model.dependencies.assertUnique]
    }
)
model.assertMismatch(
    ["0h00","12h00", "platinum_staging_assertion", "monitoring_prd_realtime-user"],
    {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
        
    }
)