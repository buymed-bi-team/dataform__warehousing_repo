// << DEPRECATED >>


/**
 * Hàm DeclareVariables: Sinh ra các câu lệnh DECLARE cho biến.
 * @param {string} baseName - Tên biến cơ sở (ví dụ: myVar)
 * @param {string} varType - Kiểu của biến trong BigQuery (ví dụ: STRING, INT64, TIMESTAMP, ...)
 * @param {number} count - Số lượng biến cần khai báo
 * @returns {string} Chuỗi SQL chứa các câu lệnh DECLARE cho các biến có pattern {baseName}_{index}
 */
function DeclareArrayVariables(baseName, count, varType) {
    let sql = "";
    for (let i = 1; i <= count; i++) {
        sql += `DECLARE ${baseName}_${i} ARRAY<${varType}>;\n`;
    }
    return sql;
}

/**
 * Hàm Variables: List ra các tên biến
 * @param {string} baseName - Tên biến cơ sở (ví dụ: myVar)
 * @param {number} count - Số lượng biến đã khai báo
 * @returns {string} Chuỗi SQL chứa tên các biến ( ví dụ "myVar_1 , myVar_2" )
 */
function ArrayVariables(baseName, count) {
    let sql = "";
    for (let i = 1; i <= count; i++) {
        sql += `${baseName}_${i} ${i < count  ? ', ' : ''}`;
    }
    return sql;
}

/**
 * Hàm ArrayConcat: Gộp tất cả các biến thành 1 ARRAY, bằng cách sử dụng function ARRAY_CONCAT()
 * @param {string} baseName - Tên biến cơ sở (ví dụ: myVar)
 * @param {number} count - Số lượng biến đã khai báo
 * @returns {string} SQL syntax dùng để concat các biến ( ví dụ "ARRAY_CONCAT(myVar_1, myVar_2)" )
 */
function ArrayConcat(baseName, count) {
    let sql = "ARRAY_CONCAT(";
    for (let i = 1; i <= count; i++) {
        sql += `${baseName}_${i} ${i < count  ? ', ' : ')'}`;
    }
    return sql;
}

/**
 * Hàm distributeValuesToArrs: Sinh ra các câu lệnh SET cho biến.
 * @param {string} baseName - Tên biến cơ sở (ví dụ: myVar)
 * @param {Array} values - Mảng các giá trị cần set; mảng này có độ dài bằng count của biến đã khai báo.
 *                         Lưu ý: Nếu giá trị là chuỗi, hàm sẽ tự động bọc nó trong dấu nháy đơn.
 * @returns {string} Chuỗi SQL chứa các câu lệnh SET cho các biến theo pattern {baseName}_{index}
 */
function DistributeValuesToArrs_Select(baseName, count, fieldName, remaining_bytes = false) {
    let sql = "";
    for (let i = 1; i <= count + 1; i++) {
        if (i <= count  ) {
            sql += `ARRAY_AGG(IF(grp = ${i}, ${fieldName}, NULL) IGNORE NULLS) AS ${baseName}_${i}, \n`
        }
        else {
            if ( remaining_bytes == true) {
                sql += `SUM(IF(grp = ${i}, byte_length, 0)) AS ${baseName}_remaining_bytes\n`
            }
            
        }
    }
    return sql;
}

function DistributeValuesToArrs_Prepare(baseName, count, fieldName) {
    let sql = `${fieldName},\nBYTE_LENGTH(${fieldName}) AS byte_length,\nSUM(BYTE_LENGTH(${fieldName})) OVER (ORDER BY ${fieldName} ) AS running_bytes,\nCASE \n`;
    for (let i = 1; i <= count + 1; i++) {
        if (i <= count  ) {
            sql += `    WHEN SUM( BYTE_LENGTH(${fieldName})) OVER (ORDER BY ${fieldName} ) <= ${i * 500000} THEN ${i} \n`
        }
        else {
                sql += `ELSE ${i} \n`

        }
    }
    sql += `END AS grp`
    return sql;
}

function DistributeValuesToArrs(table_id , where_syntax ,baseName, count, fieldName, remaining_bytes = false) {
    let sql = `(
        SELECT 
            ${DistributeValuesToArrs_Select(baseName, count, fieldName, remaining_bytes)}
        FROM (
            SELECT 
                ${DistributeValuesToArrs_Prepare(baseName, count, fieldName)} 
            FROM  (
                SELECT DISTINCT ${fieldName} FROM ${table_id}
                ${ where_syntax == "" ? "" : "WHERE " + where_syntax  }
            )
        )
    )`
    return sql
}



module.exports = { 
    DeclareArrayVariables , 
    ArrayVariables ,
    ArrayConcat,
    DistributeValuesToArrs
};


/* Ví dụ sử dụng:

// Sinh ra câu lệnh khai báo 5 biến kiểu STRING có tên: myVar_1, myVar_2, ..., myVar_5
const declareSQL = generateDeclareStatements("myVar", "STRING", 5);
console.log("DECLARE SQL:\n", declareSQL);

// Giả sử bạn có mảng giá trị để set cho 5 biến trên:
const values = ["Alice", "Bob", "Charlie", "David", "Eve"];
const setSQL = generateSetStatements("myVar", values);
console.log("SET SQL:\n", setSQL);

Kết quả in ra sẽ là:

DECLARE SQL:
 DECLARE myVar_1 STRING;
DECLARE myVar_2 STRING;
DECLARE myVar_3 STRING;
DECLARE myVar_4 STRING;
DECLARE myVar_5 STRING;

SET SQL:
 SET myVar_1 = 'Alice';
SET myVar_2 = 'Bob';
SET myVar_3 = 'Charlie';
SET myVar_4 = 'David';
SET myVar_5 = 'Eve';
*/
