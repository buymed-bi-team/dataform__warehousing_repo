
const model = new main.PlatinumModel(
    "circa_online_prd_product_sell_area",
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
    ["platinum_0h00", "platinum_12h00", "platinum_staging", "circa_online_prd_product_sell_area"],
    {
        has_src_created_date : false,
        ingestCutOffInterval : "INTERVAL 1 MONTH"
    }
);
