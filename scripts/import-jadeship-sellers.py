"""Refresh Jadeship's public Yupoo seller directory. Standard library only."""
import argparse, concurrent.futures, datetime, html, json, re, urllib.parse, urllib.request
from pathlib import Path
SOURCE='https://www.jadeship.com/sellers/platform/yupoo'
def fetch(url):
    with urllib.request.urlopen(url,timeout=30) as response:return response.read().decode('utf8')
def text(markup):return ' '.join(html.unescape(re.sub('<[^>]+>',' ',markup)).split())
def is_yupoo(url):
    try:
        p=urllib.parse.urlsplit(url)
        return p.scheme=='https' and p.hostname and p.hostname.endswith('.yupoo.com')
    except ValueError:return False

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--snapshots',type=Path);parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'data'/'sellers.json');args=parser.parse_args()
    def page(n):return (args.snapshots/f'yupoo-{n}.html').read_text('utf8') if args.snapshots else fetch(SOURCE+('' if n==1 else '?page='+str(n)))
    first=page(1);last=max([1]+[int(n) for n in re.findall(r'/sellers/platform/yupoo\?page=(\d+)',first)])
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:pages=[first]+list(pool.map(page,range(2,last+1)))
    sellers=[]
    for markup in pages:
        body=re.search(r'<tbody[^>]*>(.*?)</tbody>',markup,re.S)
        if not body:raise ValueError('Source table missing; refusing to overwrite directory')
        for row in re.findall(r'<tr[^>]*>(.*?)</tr>',body[1],re.S):
            cells=re.findall(r'<td[^>]*>(.*?)</td>',row,re.S)
            if len(cells)!=6:raise ValueError('Source row structure changed')
            name=text(cells[1]);profile=html.unescape(re.search(r'href="([^"]+)"',cells[1])[1]);match=re.search(r'href="(https?://[^"]+)"',cells[2]);primary=html.unescape(match[1]) if match else None
            urls=[primary] if primary and is_yupoo(primary) else []
            urls+=['https://'+u.replace('.comalbums','.com/albums') for u in re.findall(r'([\w-]+\.[xv]\.yupoo\.com(?:albums|/albums|/contact)?)',text(cells[2])+' '+text(cells[3]),re.I)]
            tags=[text(t).replace('CoutureReps Trusted Seller','CoutureReps list') for t in re.findall(r'<a[^>]*>(.*?)</a>',cells[4],re.S)]
            source='https://www.jadeship.com'+urllib.parse.quote(profile,safe='/')
            if not urls:
                try:urls=[html.unescape(u) for u in re.findall(r'href="(https?://[^\"]+)"',fetch(source)) if is_yupoo(html.unescape(u))]
                except (OSError,ValueError):pass
            # This source entry has a deleted detail page with trailing spaces.
            if profile.rsplit('/',1)[-1].strip()=='Mr Lin':source=SOURCE
            unique_urls={}
            for url in urls:
                parsed=urllib.parse.urlsplit(url);account=parsed.hostname if parsed.hostname not in ['x.yupoo.com','v.yupoo.com'] else parsed.hostname+parsed.path
                unique_urls.setdefault(account,url)
            urls=list(unique_urls.values())
            sellers.append({'id':profile.rsplit('/',1)[-1].strip(),'name':name,'yupooUrls':list(dict.fromkeys(urls)),'website':primary,'sourceUrl':source,'tags':tags})
    if len(sellers)<200 or len({s['id'].casefold() for s in sellers})!=len(sellers):raise ValueError('Incomplete or duplicate source entries')
    result={'sourceUrl':SOURCE,'sourceName':'Jadeship','sourcePages':last,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'count':len(sellers),'sellers':sellers}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps({'sellers':len(sellers),'pages':last,'withYupoo':sum(bool(s['yupooUrls']) for s in sellers)}))
if __name__=='__main__':main()
