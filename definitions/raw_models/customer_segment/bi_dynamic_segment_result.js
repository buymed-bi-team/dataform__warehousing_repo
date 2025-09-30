const {query_segment} = require('/includes/import_customer_segment/query_segment.js')

function main() {
    const arr_segment = publish("segment_ids", {schema: "gold_buymed_vn2__stg"}).query(`
        SELECT DISTINCT segment_id 
        FROM gold_buymed_vn2.bi_dynamic_segment
    `);

    const arr_customer = publish("customer_segments", {schema: "gold_buymed_vn2__stg"}).query(`
        SELECT * 
        FROM gold_buymed_vn2.bi_dynamic_segment 
        WHERE table = "CUSTOMER"
    `);

    const arr_order = publish("order_segments", {schema: "gold_buymed_vn2__stg"}).query(`
        SELECT * 
        FROM gold_buymed_vn2.bi_dynamic_segment 
        WHERE table = "ORDER"
    `);

    const arr_operator = publish("operator_segments", {schema: "gold_buymed_vn2__stg"}).query(`
        SELECT * 
        FROM gold_buymed_vn2.bi_dynamic_segment 
        WHERE table = "OPERATOR"
    `);


    let query = [];

    for(let i = 0; i < arr_segment.length; i++){
        let customer = arr_customer.filter(segment => segment.segment_id == arr_segment[i]);
        let objCustomer = {
            customer_status: customer.find(c => c.field == "customer_status")?.value,
            customer_level: customer.find(c => c.field == "customer_level")?.value,
            config_fc: customer.find(c => c.field == "config_fc")?.value,
            province_code: customer.find(c => c.field == "province_code")?.value,
            customer_tag_group: customer.find(c => c.field == "customer_tag_group")?.value,
            customer_tag_sub_group: customer.find(c => c.field == "customer_tag_sub_group")?.value
        };
        let order = arr_order.filter(segment => segment.segment_id == arr_segment[i]);
        let objOrder = {
            created_at: order.find(o => o.field == "created_at")?.value.toLowerCase(),
            seller_code: order.find(o => o.field == "seller_code")?.value,
            product_id: order.find(o => o.field == "product_id")?.value
        };
        let operator = arr_operator.find(segment => segment.segment_id == arr_segment[i])?.value;
        const sql = query_segment(
            arr_segment[i],
            {
                customer:objCustomer,
                order1:objOrder,
                customer_type: operator
        });

        query.push(sql)
    }

    const finalQuery = query.join(" UNION ALL ");

    return publish(
        "bi_dynamic_segment_result",
        {
            type: "incremental",
            schema:"gold_buymed_vn2__stg",
            dependencies: ["segment_ids", "customer_segments", "order_segments","operator_segments"],
            tags: ["2h00"],
        }
    ).query(finalQuery);

}
main()