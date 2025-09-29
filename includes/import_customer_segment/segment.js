function query_customer({customer_status, customer_level, config_fc, province_code, customer_tag_group, customer_tag_sub_group}) {
    
    let condition = "WHERE 1 = 1 "

    if(customer_status != null) {
        let arr = customer_status.split(",");
        let str = arr.map(item => `"${item}"`).join(", ");
        condition = condition + "AND customer_status IN (" + str + ") ";
    } 

    if(customer_level != null) {
        let arr = customer_level.split(",");
        let str = arr.map(item => `"${item}"`).join(", ");
        condition = condition + "AND customer_level IN (" + str + ") ";
    }

    if(config_fc != null) {
        let arr = config_fc.split(",");
        let str = arr.map(item => `"${item}"`).join(", ");
        condition = condition + "AND config_fc IN (" + str + ") ";
    }

    if(province_code != null) {
        let arr = province_code.split(",");
        let str = arr.map(item => `"${item}"`).join(", ");
        condition = condition + "AND province_code IN (" + str + ") ";
    }

    if(customer_tag_group != null) {
        let arr = customer_tag_group.split(",");
        let str = arr.map(item => `"${item}"`).join(", ");
        condition = condition + "AND customer_tag_group IN (" + str + ") ";
    }

    if(customer_tag_sub_group != null) {
        let arr = customer_tag_sub_group.split(",");
        let str = arr.map(item => `"${item}"`).join(", ");
        condition = condition + "AND customer_tag_sub_group IN (" + str + ") ";
    }

    return `(
        SELECT customer_id
        FROM gold_buymed_vn2.dim_customer
        ${condition}
    )`
}

function query_order({created_at, seller_code, product_id}) {
    let condition = 'WHERE 1 = 1 AND o.channel = "MARKETPLACE" AND o.order_status <> "CANCEL" AND ';

    if(created_at != null){
        let arr = created_at.split(",");
        let newArr = arr.map(item => `"${item}"`);
        let f = newArr[0];
        let l;
        if(newArr.length > 1) l = newArr[1];
        let d = new Date();
        let start_date;
        let end_date;

        // get start_date
        if(f[1] == "l") {
            let period = f[f.length - 2];
            let number = f.slice(2, f.length - 2);
            let ds = new Date(d);
            switch (period) {
                case "d":
                    ds.setDate(ds.getDate() - number);
                    break;
                case "m":
                    ds.setMonth(ds.getMonth() - number);
                    break;
                case "w":
                    ds.setDate(ds.getDate() - 7*number);
                    break;
                default:
                    break;
            }
            start_date = '"'+ ds.getFullYear().toString() + "-" + ("0" + (ds.getMonth() + 1)).slice(-2) + "-"+  ("0" + (ds.getDate())).slice(-2)+ '"';
        } else {
            start_date = f;
        }

        // get end_date
        if(l == null) {
            end_date = '"' + d.getFullYear().toString() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-"+  ("0" + (d.getDate())).slice(-2) + '"';
        } else {
            if(l[1] == "l") {
                let period = l[l.length - 2];
                let number = l.slice(2, l.length - 2);
                let ds = new Date(d);
                switch (period) {
                    case "d":
                        ds.setDate(ds.getDate() - number);
                        break;
                    case "m":
                        ds.setMonth(ds.getMonth() - number);
                        break;
                    case "w":
                        ds.setDate(ds.getDate() - 7*number);
                        break;
                    default:
                        break;
                }
                end_date = '"' + ds.getFullYear().toString() + "-" + ("0" + (ds.getMonth() + 1)).slice(-2) + "-"+  ("0" + (ds.getDate())).slice(-2) + '"';
            } else {
                end_date = l
            }
        }

        condition = condition + "DATE(oi.created_at) BETWEEN " + start_date + " AND " + end_date + " " 
        + "AND DATE(o.created_at) BETWEEN " + start_date + " AND " + end_date + " "
    }

    if(seller_code != null) {
        let arr = seller_code.split(",");
        let str = arr.map(item => `"${item}"`).join(", ");
        condition = condition + "AND seller_code IN (" + str + ") ";
    }
    
    if(product_id != null) {
        let arr = product_id.split(",");
        let str = arr.join(", ");
        condition = condition + "AND product_id IN (" + str + ") ";
    }

    return `
        SELECT 
            oi.customer_id
        FROM gold_buymed_vn2.fact_order_item AS oi
            LEFT JOIN gold_buymed_vn2.fact_order AS o ON oi.order_id = o.order_id
        ${condition}
        GROUP BY 1
    `
}

function segment({customer, order1, order2, customer_type, product1, product2, operator}) {
    let query = ` AND `;

    let qCustomer = query_customer({
        customer_status: customer.customer_status,
        customer_level: customer.customer_level,
        config_fc: customer.config_fc,
        province_code: customer.province_code,
        customer_tag_group: customer.customer_tag_group,
        customer_tag_sub_group: customer.customer_tag_sub_group
    })

    let qOrder = query_order({
        created_at: order1.created_at,
        seller_code: order1.seller_code,
        product_id: product1,
    })

    if(customer_type == "NEW") {
        query = query + `NOT EXISTS ${qCustomer}`;
    }

    return query
}

module.exports = { segment };