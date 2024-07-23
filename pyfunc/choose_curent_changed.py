def remove_unwanted_changes(content):
  """
  This function removes lines from the provided content that don't contain `${source.silver}`.

  Args:
      content: A string containing the content with potential changes.

  Returns:
      A string with only the lines containing `${source.silver}`.
  """
  lines = content.splitlines()
  filtered_lines = [line for line in lines if "${source.silver}" in line]
  return "\n".join(filtered_lines)

# Example usage
original_content = """
<<<<<<< HEAD 
FROM ${source.silver}.seller_prd_promotion_rebate o 
======= 
FROM silver.source.seller_prd_promotion_rebate o 
>>>>>>> refs/heads/main 
sakljcnsajklcn salkcmlksamc 
<<<<<<< HEAD 
FROM ${source.silver}.seller_prd_promotion_rebate o 
======= 
FROM silver.source.seller_prd_promotion_rebate o 
>>>>>>> refs/heads/main 
"""

filtered_content = remove_unwanted_changes(original_content)

print(filtered_content)