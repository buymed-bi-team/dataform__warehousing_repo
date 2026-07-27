const model = new main.PlatinumModel(
    "circa_chat_users", {
        target_schema: "platinum_buymed_vn__stg",
        has_lastUpdatedTime: false,
        has_createdTime: false,
        lastUpdatedTimeField: "updated_at",
        createdTimeField: "created_at",      
        bigquery: {
            partitionBy: "created_date"
        }
    }
);

model.createIncremental(
    ["platinum_0h00", "platinum_12h00", "platinum_staging", "circa_chat"], {
        has_src_created_date: false,
        ingestCutOffInterval: "INTERVAL 1 MONTH"
    }
);

// model.assertUnique(
//     ["platinum_0h00", "platinum_12h00", "platinum_unique_assertion", "circa_chat"], {
//         intervalCheckpoint: `INTERVAL 1 YEAR`,
//         maxRetry: 2
//     }
// );

// model.createMismatchAssertionView(
//     ["platinum_staging_assertion_view", "circa_chat"], {
//         intervalCheckpoint: `INTERVAL 2 DAY`,
//         maxRetry: 2,
//         dependencies: [{
//             schema: "platinum_buymed_vn",
//             name: "circa_chat_users"
//         }]
//     }
// );

// model.assertMismatch(
//     ["platinum_0h00", "platinum_12h00", "platinum_staging_assertion", "circa_chat"], {
//         intervalCheckpoint: `INTERVAL 2 DAY`,
//         maxRetry: 2
//     }
// );