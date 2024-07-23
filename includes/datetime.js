function current_date() {
    var d = new Date();
    var strDate = d.getFullYear().toString() + ("0" + (d.getMonth() + 1)).slice(-2) + d.getDate().toString();
    return strDate
}

module.exports = { current_date };

// action_key = 
// var sold_ = 'Fact_Seller_Selling_Suggestion'[hasEverSold]
// var event_ = 'Fact_Seller_Selling_Suggestion'[event]
// var res = IF(
//     event_ = "SUGGESTION_SELLING_CTA_CLICK"
//     , IF(
//         'Fact_Seller_Selling_Suggestion'[hasEverSold] = "true" , "INITIAL_UPDATE_PRODUCT" , "INITIAL_LISTING_PRODUCT"
//     )
//     , SWITCH(
//         TRUE()
//         , event_ = "SUGGESTION_SELLING_UPDATE_PRODUCT" , "CONFIRM_UPDATE_PRODUCT"
//         , event_ = "SUGGESTION_SELLING_CREATE_PRODUCT" , "CONFIRM_LISTING_PRODUCT"
//         , BLANK()
//     )
// )
// RETURN res