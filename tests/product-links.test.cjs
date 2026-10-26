'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('function parseLink(raw)'),html.indexOf('const rates='));
const context=vm.createContext({URL,AFF_CODE:'9enta',AFF:'https://ikako.vip/r/9enta'});
vm.runInContext(source+'\nglobalThis.links={parseLink,buyLinkFor};',context);
const {parseLink,buyLinkFor}=context.links;
test('the source item wins over a stale hand-entered buying link',()=>{
 const result=new URL(buyLinkFor({productLink:'https://weidian.com/item.html?itemID=123',kakobuyLink:'https://www.kakobuy.com/item/details?url=wrong'}));
 assert.equal(result.searchParams.get('url'),'https://weidian.com/item.html?itemID=123');
 assert.equal(result.searchParams.get('affcode'),'9enta');
});
test('tracking parameters are removed and the source URL is encoded exactly once',()=>{
 const result=new URL(buyLinkFor({productLink:'https://item.taobao.com/item.htm?id=456&spm=tracking&skuId=789'}));
 assert.equal(result.searchParams.get('url'),'https://item.taobao.com/item.htm?id=456');
 assert.equal(parseLink('https://detail.tmall.com/item.htm?id=456').key,'tb:456');
});
test('every bundled product resolves to its own source ID rather than a signup page',()=>{
 const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalogue.json'),'utf8'));
 for(const row of rows){
  const target=new URL(buyLinkFor({productLink:row.product_link,kakobuyLink:row.kakobuy_link,affiliateLink:row.affiliate_link}));
  assert.equal(target.pathname,'/item/details','product '+row.id);
  assert.equal(parseLink(target.searchParams.get('url')).key,parseLink(row.product_link).key,'product '+row.id);
 }
});
