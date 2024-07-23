import os
from pprint import pprint

def move_conflict(text):

    changes = []
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        conflict = ""
        if lines[i].startswith('<<<<<<<'):
            conflict += lines[i]
            i += 1
            current_change = ""
            while not lines[i].startswith('======='):
                current_change += lines[i]
                conflict += lines[i]
                i += 1

            
            i += 1
            incoming_change = ""
            while not lines[i].startswith('>>>>>>>'):
                incoming_change += lines[i]
                conflict += lines[i]
                i += 1
            conflict += lines[i]
        print(conflict,'\n')
        print(current_change,'\n')
        print(incoming_change,'\n')
        i += 1
    
    return changes


if __name__ == "__main__":
    # fpaths = []
    # dir_path = 'C:\\Users\\bi.minh.luu\\Documents\\RAW_NOTE\\warehousing_repo\\definitions'
    # for (root,dirs,files) in os.walk(dir_path, topdown=True):
    #     for fname in files:
    #         fpath = os.path.join(root,fname)
    #         fpaths.append(fpath)

    # change_dict = {}
    # for i in fpaths:
        # with open(i,'r',encoding='utf8') as f:
        #     fcontent = f.read()
        #     change_dict[i] = extract_conflicts(fcontent)
            
    with open('','r',encoding='utf8') as f:
            fcontent = f.read()
            
    move_conflict(fcontent)