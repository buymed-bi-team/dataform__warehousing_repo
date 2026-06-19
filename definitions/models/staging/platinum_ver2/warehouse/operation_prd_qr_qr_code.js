const model = new main.PlatinumModel(
    "operation_prd_qr_qr_code", {
        target_schema: "platinum_buymed_vn__stg",
        has_lastUpdatedTime: true,
        has_createdTime: true,
        bigquery: {
            partitionBy: "created_date"
        }
    }
);

model.createIncremental(
    ["platinum_0h00", "platinum_12h00", "platinum_staging", "operation_prd_qr"], {
        has_src_created_date: false,
        ingestCutOffInterval: "INTERVAL 1 MONTH"
    }
);

// model.assertUnique(
//     ["platinum_0h00", "platinum_12h00", "platinum_unique_assertion", "operation_prd_qr"], {
//         intervalCheckpoint: `INTERVAL 1 YEAR`,
//         maxRetry: 2
//     }
// );

// model.createMismatchAssertionView(
//     ["platinum_staging_assertion_view", "operation_prd_qr"], {
//         intervalCheckpoint: `INTERVAL 2 DAY`,
//         maxRetry: 2,
//         dependencies: [{
//             schema: "platinum_buymed_vn",
//             name: "operation_prd_qr_qr_code"
//         }]
//     }
// );

// model.assertMismatch(
//     ["platinum_0h00", "platinum_12h00", "platinum_staging_assertion", "operation_prd_qr"], {
//         intervalCheckpoint: `INTERVAL 2 DAY`,
//         maxRetry: 2
//     }
// );
