
const model = new main.PlatinumModel(
    "platform_insider_prd_segment_static_segment_value",
    {
        target_schema : "platinum_buymed_vn__stg", // Use for document
        // customAssertionsSchema : `dataform_playground_assertions`,
        // source_schema = source.silver,
        // description = ``,

        has_lastUpdatedTime : true,
        has_createdTime : true,
        bigquery: {
            partitionBy: "created_date",
        }
    }
);
model.createIncremental(
    ["platinum_0h00", "platinum_12h00", "platinum_staging", "platform_insider_prd_segment_static_segment_value"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
