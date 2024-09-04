contextable = {
    tags:('0h00')
}

const columns = [
    'oiid',
    'order_id',
    'product_id',
    'sku_code',
    'supplier_code',
    'product_id_original',
    'sku_code_original',
    'supplier_code_original',
    'created_dt',
    'price',
    'demand_quantity'
]

columns.map((c,i) => 
assert(
    `assert_fact_strategic_sale_order_item_single_nonNull_${c}`,
    contextable
).query(ctx =>`
SELECT
  '${c} IS NOT NULL' AS failing_row_condition,
  ${c}
FROM ${ctx.ref(`fact_strategic_sale_order_item_single`)}
WHERE NOT (order_id IS NOT NULL)`
));

assert(
    'assert_fact_strategic_sale_order_item_single_unique',
    contextable
).query(
    ctx => `
SELECT
    'order_id IS NOT UNIQUE',
    order_id
FROM ${ctx.ref(`fact_strategic_sale_order_item_single`)}
GROUP BY order_id
HAVING COUNT(1) > 1`
)