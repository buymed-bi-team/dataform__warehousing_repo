from lab.replace_source import replace_source
import os

dir_path = 'C:\\Users\\bi.minh.luu\\Documents\\RAW_NOTE\\warehousing_repo\\definitions\\models\\marts'

for (root,dirs,files) in os.walk(dir_path, topdown=True):
    for fname in files:
        fpath = os.path.join(root,fname)
        with open(fpath,'r',encoding="utf8") as f:
            content = f.read()
        
        content = replace_source(content)

        with open(fpath,'w',encoding="utf8") as f:
            f.write(content)
