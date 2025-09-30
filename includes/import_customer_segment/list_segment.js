async function loadSegments() {
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

  return { arr_segment, arr_customer, arr_order, arr_operator };
}

module.exports = { loadSegments };