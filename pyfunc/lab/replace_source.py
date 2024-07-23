import re


def replace_source_in_js_block(file_content):
    def replace_group_table(match):
        # Extract the entire pattern including the placeholders
        full_match = match.group(0)
        # print(full_match)

        # Extract the table name from the full match
        # The pattern looks like "${group_table.silver_buymed_vn.table_name}"
        table_pattern = r'[\'"`]\s*(lakehouse-prod-394907\.silver_buymed_vn|silver_buymed_vn)\.(\w+)\s*[\'"`]'
        table_name_match = re.search(table_pattern, full_match)
        
        if table_name_match:
            table_name = table_name_match.group(2)
            # print('\t',table_name)
            # Construct the replacement string
            replacement = f"source.silver + `.{table_name}`"
            # Replace `group_table` with the constructed string
            return re.sub(table_pattern,replacement,full_match)
        return full_match

    # Define the regex pattern to match the required structure
    pattern = r'\$\{[^}]*?\}'
    
    # Perform the replacement using the defined function
    return re.sub(pattern, replace_group_table, file_content)

def replace_source_out_of_js_block(file_content: str):
    table_pattern = r'[\'"`]?\s*(lakehouse-prod-394907\.silver_buymed_vn|silver_buymed_vn)\.(\w+)\s*[\'"`]?'
    file_content_match = re.search(table_pattern, file_content)

    if file_content_match:
            table_name = file_content_match.group(2)
            # print('\t',table_name)
            # Construct the replacement string
            replacement = f" ${{source.silver}}.{table_name} "
            # Replace `group_table` with the constructed string
            file_content = re.sub(table_pattern,replacement,file_content)
    
    return file_content

def replace_source(file_content: str):
    file_content = replace_source_in_js_block(file_content)
    file_content = replace_source_out_of_js_block(file_content)

    return file_content

if __name__ == "__main__":
    # Sample input string
    input_string = """
    config { asdasd }
    ${ "silver_buymed_vn.table_a" }
    Some text ${ 
    `silver_buymed_vn.table_b` } and more text.
    ${ ` lakehouse-prod-394907.silver_buymed_vn.table_132c `} ending here.

    lakehouse-prod-394907.silver_buymed_vn.table_132c
    ` lakehouse-prod-394907.silver_buymed_vn.table_132c `
    'silver_buymed_vn.table_b'
    """
    print(replace_source(input_string))