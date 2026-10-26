"""Canonical buying links for the static catalogue; matches the browser's source-first rule."""
from urllib.parse import urlparse, parse_qs, quote
import re


def canonical_product_link(raw):
    parsed = urlparse(str(raw or '').strip())
    host = (parsed.hostname or '').lower()
    query = {key.lower(): values[0] for key, values in parse_qs(parsed.query).items()}
    if re.search(r'(^|\.)(taobao|tmall)\.com$', host):
        item_id = query.get('id', '')
        if re.fullmatch(r'[0-9]+', item_id):
            return f'https://item.taobao.com/item.htm?id={item_id}'
    if re.search(r'(^|\.)weidian\.com$', host):
        item_id = query.get('itemid', '')
        if re.fullmatch(r'[0-9]+', item_id):
            return f'https://weidian.com/item.html?itemID={item_id}'
    return ''


def buy_link_for(product):
    source = canonical_product_link(product.get('product_link'))
    if source:
        return 'https://www.kakobuy.com/item/details?url=' + quote(source, safe='') + '&affcode=9enta'
    return product.get('kakobuy_link') or product.get('affiliate_link') or 'https://ikako.vip/r/9enta'
