"""Bake the local catalogue into HTML so the product grid also works without JavaScript."""
import html,json,re
from pathlib import Path
from product_links import buy_link_for
root=Path(__file__).resolve().parents[1]
rows=json.loads((root/'data/catalogue.json').read_text('utf8'));aliases=json.loads((root/'data/image-aliases.json').read_text('utf8'));clean=json.loads((root/'img/clean/index.json').read_text('utf8'))
esc=lambda value:html.escape(str(value or ''),quote=True)
cards=[]
for i,p in enumerate(rows):
    original=(p.get('images') or [p['image']])[0];image='/img/clean/'+clean[str(p['id'])]+'.webp' if str(p['id']) in clean else aliases.get(original,original)
    link=buy_link_for(p)
    title=p['name'];brand=p.get('brand') or ''
    if brand and title.lower().startswith(brand.lower()+' '):title=title[len(brand)+1:]
    label=' / '.join(v for v in [brand,p.get('seller')] if v)
    price='¥'+str(p['cny']).removesuffix('.0') if p['cny'] else 'View store'
    cards.append(f'''<article class="card"><a class="photo full-product" href="{esc(link)}" target="_blank" rel="noopener" data-view="{p['id']}" aria-label="View {esc(p['name'])}"><img class="in" src="{esc(image)}" alt="{esc(p['name'])}" width="400" height="500" loading="{'eager' if i<4 else 'lazy'}" decoding="async"></a><div class="content"><div class="topline"><div class="eyebrow">{esc(label)}</div><h3 class="name">{esc(title)}</h3><div class="meta-row"><a href="{esc(p['product_link'])}" target="_blank" rel="noopener">Original listing ↗</a></div></div><div class="actions"><a class="buy" href="{esc(link)}" target="_blank" rel="noopener"><span class="buy-label">Buy on Kakobuy ↗</span><span class="buy-price">{esc(price)}</span></a></div></div></article>''')
p=root/'index.html';s=p.read_text('utf8');s=re.sub(r'<section class="grid" id="grid">.*?</section>',lambda _: '<section class="grid" id="grid">\n'+ '\n'.join(cards)+'\n</section>',s,count=1,flags=re.S)
s=re.sub(r'(<b id="statItems">)\d+(</b>)',lambda m:m[1]+str(len(rows))+m[2],s,count=1)
p.write_text(s,encoding='utf8');print('Baked',len(cards),'product cards with direct shopping links')
