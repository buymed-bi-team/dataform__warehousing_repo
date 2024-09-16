function current_date() {
    var d = new Date();
    var strDate = d.getFullYear().toString() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + d.getDate().toString();
    return strDate
}
function current_datetime() {
    var d = new Date();
    function twoNum(num) {
        return ("0" + (num + 1)).slice(-2)
    }
    var strDate = d.getFullYear().toString() + twoNum(d.getMonth()) + d.getDate().toString();
    var strTime = twoNum(d.getHours() + 6) + twoNum(d.getMinutes());
    return strDate + '_' + strTime
}

function getPastDate(intervalDays = 0, intervalMonths = 0) {
    // WHERE date > ${getPastDate({intervalDays:10})} == WHERE data > CURRENT_DATE() - INTERVAL 10 DAY 
    // For ex: today = 2024-09-16 ->  ${getPastDate({intervalDays:10})} = 2024-09-06
    // Get today's date
    const today = new Date();

    // Subtract the specified number of days
    today.setDate(today.getDate() - intervalDays);

    // Subtract the specified number of months
    today.setMonth(today.getMonth() - intervalMonths);

    // Return the resulting date in YYYY-MM-DD format
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}
function getPastDatetime({intervalDays = 0, intervalMonths = 0 , intervalHours = 0, intervalMinutes = 0 } = {}) {
    // Not support Second, because it too small
    
    // Get today's date
    const today = new Date();
    today.setHours(today.getHours() +7); // Timezone

    // Subtract
    today.setDate(today.getDate() - intervalDays);
    today.setMonth(today.getMonth() - intervalMonths);
    today.setHours(today.getHours() - intervalHours);
    today.setMinutes(today.getMinutes() - intervalMinutes);

    // Return the resulting date in YYYY-MM-DD format
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');

    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:00`;
}

function isDaysOfWeek(...DaysOfWeek) {
    const today = new Date().getDay();

    // Convert Day Of Week from string to num
    if (DaysOfWeek.every(day => typeof day === 'string')){
        // Convert the days of the week input to lowercase for easier comparison
        const daysMap = {
            'sunday': 0,
            'monday': 1,
            'tuesday': 2,
            'wednesday': 3,
            'thursday': 4,
            'friday': 5,
            'saturday': 6,

            'sun': 0,
            'mon': 1,
            'tue': 2,
            'wed': 3,
            'thu': 4,
            'fri': 5,
            'sat': 6,
        };

        // Check if today is in the provided days of the week
        DaysOfWeek = DaysOfWeek.map(day => day.toLowerCase()).map(day => daysMap[day]);
    } 
    else if ( DaysOfWeek.some(day => typeof day === 'string') ){ 
        return "isDaysOfWeek Error: inputs must all string or all integer"
    }
    return DaysOfWeek.some(day => day === today)
}

/* Cần dành thời gian để nghiên cứu thêm các trưởng hợp của IsCurrentTimeInRange 
Test case:
1- "6:00" , "9:00"
2- "6:00 am", "9:00 pm"
3- "6:00", "21:00"
4- "6:00 am", "21:00"
5- "22:00", "7:00"
6- "10:00 pm", "3:00"
7- "10:00pm", "8:00am"
*/

function isCurrentTimeInRange(startTime, endTime) { 
    /* CAN'T USE CURRENTLY */
     
    // Function to convert time string to hours in 24-hour format
    function convertTo24HourFormat(time) {
        const [timePart, modifier] = time.split(' '); // Split time and modifier (if any)
        let [hours, minutes] = timePart.split(':').map(Number); // Split hours and minutes

        // Handle AM/PM
        if (modifier) {
            if (modifier.toLowerCase() === 'pm' && hours < 12) {
                hours += 12; // Convert PM hour to 24-hour format
            }
            if (modifier.toLowerCase() === 'am' && hours === 12) {
                hours = 0; // Convert 12 AM to 0 hours
            }
        }

        return hours + minutes / 60; // Return total hours as a decimal
    }

    // Get the current time in hours
    const now = new Date();
    const currentHours = now.getHours() + now.getMinutes() / 60;

    // Convert input times to 24-hour format
    const startHours = convertTo24HourFormat(startTime);
    const endHours = convertTo24HourFormat(endTime);

    // Handle overnight ranges (e.g., 22:00 to 7:00)
    if (startHours > endHours) {
        return currentHours >= startHours || currentHours < endHours; // Wraps around midnight
    }

    // Regular range check
    return currentHours >= startHours && currentHours < endHours;
}

module.exports = { current_date , getPastDate , getPastDatetime , isDaysOfWeek , isCurrentTimeInRange, current_datetime };

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