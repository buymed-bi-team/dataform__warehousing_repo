
const model = new main.PlatinumModel(
    "warehouse_prd_inbound_return_ticket",
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
    ["platinum_00h00", "platinum_staging", "warehouse_prd_inbound"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
