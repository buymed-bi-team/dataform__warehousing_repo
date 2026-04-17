const model = new main.PlatinumModel(
    "circa_online_prd_consumer_benefit_log", {
        target_schema: "platinum_buymed_vn__stg",
        has_lastUpdatedTime: true,
        has_createdTime: true,
        bigquery: {
            partitionBy: "created_date"
        }
    }
);

model.createIncremental(
    ["platinum_0h00", "platinum_12h00", "platinum_staging", "circa-online_prd_consumer"], {
        has_src_created_date: false,
        ingestCutOffInterval: "INTERVAL 1 MONTH"
    }
);

model.assertUnique(
    ["platinum_0h00", "platinum_12h00", "platinum_unique_assertion", "circa-online_prd_consumer"], {
        intervalCheckpoint: `INTERVAL 1 YEAR`,
        maxRetry: 2
    }
);

model.createMismatchAssertionView(
    ["platinum_staging_assertion_view", "circa-online_prd_consumer"], {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2,
    }
);

model.assertMismatch(
    ["platinum_0h00", "platinum_12h00", "platinum_staging_assertion", "circa-online_prd_consumer"], {
        intervalCheckpoint: `INTERVAL 2 DAY`,
        maxRetry: 2
    }
);
