

const model = new main.PlatinumModel(
    "platform_core_prd_activity_activity",
    {
        target_schema : "platinum_buymed_vn__stg", 
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : false,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
            clusterBy: ["template_code"]
        }
    }
);
model.createIncremental(
    ["platinum_0h00","platinum_weekend_full_refresh_13h40","platform_core_prd_activity"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
// model.assertUnique(
//     ["platinum_09h00", "core_prd_activity"],
//     {
//         intervalCheckpoint : `INTERVAL 1 YEAR`,
//         maxRetry: 2
//     }
// )
// model.createMismatchAssertionView(
//     ["core_prd_activity"],
//     {
//         intervalCheckpoint: `INTERVAL 2 DAY`,
//         maxRetry: 2,
//         dependencies : [{"schema":"platinum_buymed_vn","name":"platform_core_prd_activity_activity"}]
//     }
// )
// model.assertMismatch(
//     ["platinum_09h00", "core_prd_activity"],
//     {
//         intervalCheckpoint: `INTERVAL 2 DAY`,
//         maxRetry: 2,
        
//     }
// )