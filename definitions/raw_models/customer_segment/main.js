const {query_segment} = require('/includes/import_customer_segment/query_segment.js')

async function main() {
    const arr_segment = await dataform.runQuery(`
        SELECT DISTINCT segment_id 
        FROM gold_buymed_vn2.bi_dynamic_segment
    `);

    const arr_customer = await dataform.runQuery(`
        SELECT * 
        FROM gold_buymed_vn2.bi_dynamic_segment 
        WHERE table = "CUSTOMER"
    `);

    const arr_order = await dataform.runQuery(`
        SELECT * 
        FROM gold_buymed_vn2.bi_dynamic_segment 
        WHERE table = "ORDER"
    `);

    const arr_operator = await dataform.runQuery(`
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
        const sql = query_segment({
            customer:objCustomer,
            order1:objOrder,
            customer_type: operator
        });

        query.push(sql)
    }

    const finalQuery = query.join(" UNION ALL ");

    publish(
        "bi_dynamic_segment_result",
        {
            type: "incremental",
            schema:"platinum_buymed_vn__stg",
            tags: ["2h00"],
        }
    ).query(finalQuery);

}

module.exports = { main };