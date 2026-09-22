#!/usr/bin/env python3
import json,os
HERE=os.path.dirname(os.path.abspath(__file__))
d=json.load(open(os.path.join(HERE,'data','courts.json')))
data=json.dumps(d['courts'], ensure_ascii=False, separators=(',',':'))
shell=open(os.path.join(HERE,'shell.html')).read()
html=shell.replace('__DATA__', data.replace('</','<\\/'))
open(os.path.join(HERE,'index.html'),'w',encoding='utf-8').write(html)
print('ok', len(html))
