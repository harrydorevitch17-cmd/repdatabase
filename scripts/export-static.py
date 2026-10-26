"""Export the public catalogue and seller directory for static hosting."""
from pathlib import Path
import json,re,zipfile,argparse
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,default=root.parent/'exports'/'repdatabase-static.zip');args=parser.parse_args()
files={'index.html','catalogue.css','theme.css','index-refinement.css','tools.css','sellers.html','sellers.js','tutorials.html','tutorials.css','tutorials.js','data/sellers.json','data/catalogue.json','data/image-aliases.json','img/clean/index.json','img/qc.json'}
for rel in json.loads((root/'data/image-aliases.json').read_text('utf8')).values():files.add(rel.lstrip('/'))
for stem in json.loads((root/'img/clean/index.json').read_text('utf8')).values():files.add('img/clean/'+stem+'.webp')
for rel in ['img/logo-64.png','img/logo-192.png','img/apple-touch-icon.png','img/og.png']:
 if (root/rel).exists():files.add(rel)
page=(root/'index.html').read_text('utf8');start=page.index('const fetchRows=async()=>{');end=page.index('\nlet currentUser=null;',start);page=page[:start]+"const fetchRows=async()=>{const r=await fetch('/data/catalogue.json');if(!r.ok)throw Error('Catalogue unavailable');return r.json()};"+page[end:];page=page.replace('id="authBtn"','id="authBtn" hidden')
tracking=(root/'tracking.html').read_text('utf-8-sig')
readme='''repdatabase static export\n\nUpload the contents of this archive to the root of a static host. index.html is the homepage.\nThe 425-product grid is baked into HTML and works without JavaScript. JavaScript adds search, filters, saved items and product galleries. Product photos are included.\nThe seller directory contains 230 Jadeship entries. All data is a snapshot, not automatically updated.\nTracking currently displays a maintenance notice. Neocities cannot run the Vercel API functions. Management stays on the main website.\nNo analytics scripts, external fonts or automatic third-party browser requests are included on the catalogue. Shopping links open the original services when clicked.\nTo refresh after catalogue changes: update data/catalogue.json and data/image-aliases.json, run scripts/bake-catalogue.py, then run scripts/export-static.py.\n'''
args.output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(args.output,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
 for rel in sorted(files):
  if rel=='index.html':archive.writestr(rel,page)
  else:
   if not (root/rel).is_file():raise FileNotFoundError(rel)
   archive.write(root/rel,rel)
 archive.writestr('tracking.html',tracking);archive.writestr('README.txt',readme)
print(json.dumps({'archive':str(args.output),'files':len(files)+2,'megabytes':round(args.output.stat().st_size/1e6,1)}))
