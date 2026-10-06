'use strict';
const fs=require('node:fs'); const path=require('node:path');const assert=require('node:assert/strict');const {execFileSync}=require('node:child_process');
const dir=path.join(__dirname,'../extension'); const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.permissions,['storage']);
assert.equal(manifest.host_permissions,undefined);assert.deepEqual(manifest.background,{service_worker:'background.js'});assert.deepEqual(manifest.options_ui,{page:'onboarding.html',open_in_tab:true});
assert.equal(manifest.web_accessible_resources,undefined);assert.equal(manifest.externally_connectable,undefined);
const files=[...manifest.content_scripts.flatMap(x=>[...x.js,...x.css]),manifest.action.default_popup,'help.js','help.css','onboarding.html','onboarding.js','onboarding.css','background.js',...Object.values(manifest.icons)];
for(const file of files)assert(fs.existsSync(path.join(dir,file)),`Missing ${file}`);
assert.deepEqual(manifest.content_scripts[0].matches,['https://www.twitch.tv/*','https://player.twitch.tv/*']);
for(const file of fs.readdirSync(dir).filter(x=>x.endsWith('.js'))){
 const full=path.join(dir,file);execFileSync(process.execPath,['--check',full]); const source=fs.readFileSync(full,'utf8');
 for(const forbidden of [/\beval\s*\(/,/\bnew\s+Function\s*\(/,/\bsetInterval\s*\(/,/\bfetch\s*\(/,/\bWebSocket\s*\(/,/\.innerHTML\s*=/,/captureStream\s*\(/,/cloneNode\s*\(/])assert(!forbidden.test(source),`${file} forbidden ${forbidden}`);
}
console.log('Manifest, least permissions, local resources, JS syntax, and prohibited APIs: PASS');

assert.equal(manifest.default_locale,'en');
assert.equal(manifest.name,'__MSG_extensionName__');
assert.equal(manifest.description,'__MSG_extensionDescription__');
const locales=['ja','en','ko','zh_CN','es','de','fr','pt_BR','ru','ar','id'];
assert.deepEqual(fs.readdirSync(path.join(dir,'_locales')).sort(),[...locales].sort());
const messages=locales.map(locale=>JSON.parse(fs.readFileSync(path.join(dir,'_locales',locale,'messages.json'),'utf8')));
const keys=Object.keys(messages[0]).sort();
for(const catalog of messages){
 assert.deepEqual(Object.keys(catalog).sort(),keys);
 assert(catalog.extensionName.message.length<=75);
 assert(catalog.extensionDescription.message.length<=132);
 for(const value of Object.values(catalog))assert(typeof value.message==='string'&&value.message.trim());
}
const help=fs.readFileSync(path.join(dir,'help.html'),'utf8');
assert(!/<script[^>]+src=["']https?:/i.test(help));
assert(!/\bon\w+\s*=/i.test(help));
assert(!/\.innerHTML\s*=/.test(fs.readFileSync(path.join(dir,'help.js'),'utf8')));
console.log('11-locale catalogs, length limits, offline popup localization, and local script references: PASS');
