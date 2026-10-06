'use strict';
// Independent release audit. DOM/API doubles do not prove live Twitch rendering.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const {createHarness, deepElements, emit, flush} = require('./helpers/mock-browser.cjs');
const root = path.join(__dirname, '..');
const extension = path.join(root, 'extension');
const locales = ['ja','en','ko','zh_CN','es','de','fr','pt_BR','ru','ar','id'];
const catalog = locale => JSON.parse(fs.readFileSync(path.join(extension, '_locales', locale, 'messages.json'), 'utf8'));
const read = name => fs.readFileSync(path.join(extension, name), 'utf8');
const filesIn = directory => fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory()
  ? filesIn(path.join(directory, entry.name)).map(name => `${entry.name}/${name}`) : [entry.name]).sort();
const runtimeFiles = ['manifest.json','i18n.js','core.js','gear-menu.js','ui.js','content.js','content.css','help.html','help.js','help.css','onboarding.html','onboarding.js','onboarding.css','background.js',
  ...[16,32,48,128].map(size => `icons/icon${size}.png`), ...locales.map(locale => `_locales/${locale}/messages.json`)].sort();
const nativeLabels = ['ポップアウト','Popout Player','팝업 플레이어','弹出播放器','Reproductor emergente','Pop-out-Player','Ouvrir dans nouvelle fenêtre','Открыть в отдельном окне','مشغّل منبثق'];
const statuses = doc => deepElements(doc.documentElement).filter(node => node.getAttribute('role') === 'status');

for (const nativeLabel of nativeLabels) {
  test(`publication: verified native label ${nativeLabel} works independently of all eleven extension locales`, async () => {
    for (const locale of locales) {
      let nativeCalls = 0;
      const h = createHarness({locale});
      h.document.documentElement.lang = 'unmodified-native-language';
      h.document.documentElement.dir = 'unmodified-native-direction';
      const {menu,nativeRow,nativeButton} = h.openGear({label:nativeLabel,nativeAction:() => nativeCalls++});
      const nativeAttributes = [...nativeButton.attributes], nativeChildren = [...nativeButton.children];
      const entry = h.button(catalog(locale).gearEntry.message);
      assert.ok(entry, `${locale}: ${nativeLabel}`);
      assert.equal(nativeRow.nextSibling, entry.parentElement);
      assert.equal(menu.querySelectorAll('[data-tcc-gear-entry]').length, 1);
      emit(entry, 'click');
      assert.equal(h.pipRequests.length, 1, 'PiP requested in the same event stack');
      assert.equal(nativeCalls, 0);
      assert.equal(h.opened.length, 0);
      await flush();
      assert.equal(h.video.ownerDocument, h.pipWindows[0].document);
      assert.equal(nativeButton.textContent, nativeLabel);
      assert.deepEqual([...nativeButton.attributes], nativeAttributes);
      assert.deepEqual(nativeButton.children, nativeChildren);
      assert.equal(h.document.documentElement.lang, 'unmodified-native-language');
      assert.equal(h.document.documentElement.dir, 'unmodified-native-direction');
      emit(nativeButton, 'click');
      assert.equal(nativeCalls, 1);
      assert.equal(h.pipRequests.length, 1);
      h.pipWindows[0].close();
      assert.equal(h.video.parentNode, h.container);
      emit(h.window, 'pagehide', {persisted:false});
      assert.equal(h.observers.filter(observer => observer.active).length, 0);
      assert.equal(h.timers.size, 0);
    }
  });
}

test('publication: native recognition is exact and never derives anchors from extension translations', () => {
  const unverified = ['Player pop-out','Reprodutor pop-out','Pemutar pop-out',
    ...nativeLabels.flatMap(label => [`${label} extra`, `Extra ${label}`]),
    ...locales.map(locale => catalog(locale).gearEntry.message)];
  for (const locale of locales) for (const label of unverified) {
    const h = createHarness({locale});
    h.openGear({label});
    assert.equal(h.document.querySelector('[data-tcc-gear-entry]'), null, `${locale}: ${label}`);
    assert.equal(h.document.querySelector('#tcc-panel'), null);
    assert.equal(deepElements(h.document.documentElement).filter(node => node.tagName === 'IFRAME').length, 0);
    assert.equal(h.pipRequests.length, 0);
    assert.equal(h.opened.length, 0);
    emit(h.window, 'pagehide', {persisted:false});
  }
});

for (const locale of locales) {
  test(`publication: ${locale} error text, retry, blocked chat, and CSP cleanup remain localized`, async () => {
    let calls = 0;
    const h = createHarness({locale,popupBlocked:true,pipRequest:win => ++calls === 1 ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve(win)});
    const c = catalog(locale);
    h.openGear({label:'Popout Player'});
    await h.click(c.gearEntry.message);
    assert.ok(statuses(h.document).some(node => node.textContent === c.errorPipOpen.message));
    assert.equal(h.video.parentNode, h.container);
    assert.equal(h.video.pauseCount, 0);
    await h.click(c.gearEntry.message);
    const win = h.pipWindows.at(-1);
    assert.equal(h.video.ownerDocument, win.document);
    await h.click(c.separateLabel.message, win.document);
    assert.ok(statuses(win.document).some(node => node.textContent === c.errorPopupBlocked.message));
    emit(win.document, 'securitypolicyviolation', {violatedDirective:'frame-src',blockedURI:'https://www.twitch.tv/embed/example/chat'});
    const notice = statuses(win.document).find(node => node.textContent === c.errorChatEmbed.message);
    assert.ok(notice);
    assert.equal(h.video.pauseCount, 0);
    win.close();
    notice.textContent = 'listener-removed';
    emit(win.document, 'securitypolicyviolation', {violatedDirective:'frame-src',blockedURI:'https://www.twitch.tv/embed/example/chat'});
    assert.equal(notice.textContent, 'listener-removed');
    assert.equal(h.video.parentNode, h.container);
    emit(h.window, 'pagehide', {persisted:false});
  });
}

test('publication: exact approved brand, manifest permissions, and complete runtime allowlist', () => {
  assert.deepEqual(filesIn(extension), runtimeFiles);
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.background,{service_worker:'background.js'});
  assert.deepEqual(manifest.options_ui,{page:'onboarding.html',open_in_tab:true});
  assert.equal(manifest.version, '1.5.1');
  assert.deepEqual(manifest.permissions, ['storage']);
  for (const key of ['optional_permissions','host_permissions','optional_host_permissions','web_accessible_resources','externally_connectable','sandbox','update_url','key']) assert.equal(manifest[key], undefined, key);
  assert.equal(manifest.content_scripts.length, 1);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://www.twitch.tv/*','https://player.twitch.tv/*']);
  assert.equal(manifest.content_scripts[0].all_frames, false);
  assert.deepEqual(manifest.content_scripts[0].js, ['i18n.js','core.js','gear-menu.js','ui.js','content.js']);
  assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'none'");
  for (const locale of locales) {
    const c = catalog(locale);
    for (const key of ['extensionName','panelLabel']) assert.equal(c[key].message, 'PopChat for Twitch', `${locale}:${key}`);
    assert.ok(c.actionTitle.message.startsWith('PopChat for Twitch'));
    assert.ok(c.extensionName.message.length <= 75);
    assert.ok(c.extensionDescription.message.length <= 132);
  }
});

test('publication: installed icons are correctly sized raster PNGs without private metadata or runtime SVG', () => {
  for (const size of [16,32,48,128]) {
    const bytes = fs.readFileSync(path.join(extension, `icons/icon${size}.png`));
    assert.equal(bytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.subarray(12,16).toString(), 'IHDR');
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
    assert.equal(bytes[25], 6, 'RGBA supports clear icon edges');
    const chunks = [];
    for (let offset = 8; offset < bytes.length;) {
      const length = bytes.readUInt32BE(offset);
      const chunk = bytes.subarray(offset+4,offset+8).toString();
      chunks.push(chunk);
      if (chunk === 'tEXt') assert.equal(bytes.subarray(offset+8,offset+8+length).toString(), 'Software\0www.inkscape.org', 'only the known non-personal renderer tag is allowed');
      offset += 12+length;
      assert.ok(offset <= bytes.length, 'complete PNG chunks');
    }
    assert.ok(chunks.includes('IDAT'));
    assert.equal(chunks.at(-1), 'IEND');
    assert.ok(!chunks.some(chunk => ['zTXt','iTXt','eXIf'].includes(chunk)), 'no private asset metadata');
  }
  assert.ok(!filesIn(extension).some(name => name.endsWith('.svg')));
});

test('publication: runtime contains no private paths, asset downloads, remote execution, or secret patterns', () => {
  for (const file of runtimeFiles.filter(name => !name.endsWith('.png'))) {
    const value = read(file);
    for (const forbidden of [/sediment:\/\//i,/library_file_id/i,/file-[a-zA-Z0-9]{20,}/,/\/workspace\//,/\/Users\//,/assets\.twitch\.tv/i,/BEGIN [A-Z ]*PRIVATE KEY/,/\b(?:ghp|github_pat|sk_live|sk_test)_[A-Za-z0-9]{16,}/,/\b(?:XMLHttpRequest|WebSocket|EventSource)\b/,/\bfetch\s*\(/,/\bimportScripts\s*\(/,/\beval\s*\(/,/\bnew\s+Function\s*\(/,/\bsetInterval\s*\(/]) assert.doesNotMatch(value, forbidden, file);
  }
});

test('publication: isolated build is deterministic, CRC-valid, manifest-rooted, and includes only documented files', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'popchat-package-audit-'));
  try {
    for (const folder of ['extension','docs','scripts','tests']) fs.cpSync(path.join(root, folder), path.join(temporary, folder), {recursive:true});
    for (const file of ['README.md','PRIVACY.md','package.json']) fs.copyFileSync(path.join(root, file), path.join(temporary, file));
    const run = () => execFileSync('python3', [path.join(temporary,'scripts/package.py')], {encoding:'utf8'});
    const first = run(), second = run();
    assert.equal(first, second, 'two unchanged builds have identical hashes');
    const result = JSON.parse(execFileSync('python3', ['-c', `import json, pathlib, zipfile
root=pathlib.Path(${JSON.stringify(temporary)})/'dist'
result={}
for path in root.glob('*.zip'):
 with zipfile.ZipFile(path) as archive:
  assert archive.testzip() is None
  names=archive.namelist()
  assert len(names)==len(set(names))
  assert all(not n.startswith('/') and '..' not in pathlib.PurePosixPath(n).parts for n in names)
  result[path.name]=names
print(json.dumps(result))`], {encoding:'utf8'}));
    assert.deepEqual(result['popchat-for-twitch-1.5.1.zip'].sort(), runtimeFiles);
    const sourceFiles = result['popchat-for-twitch-1.5.1-source.zip'];
    assert.ok(sourceFiles.includes('popchat-for-twitch/extension/manifest.json'));
    assert.ok(sourceFiles.includes('popchat-for-twitch/tests/publication-audit.test.cjs'));
    assert.ok(sourceFiles.includes('popchat-for-twitch/docs/assets/icon.svg'));
    assert.ok(sourceFiles.every(name => /^popchat-for-twitch\/(?:extension\/|docs\/|tests\/|scripts\/|README\.md$|PRIVACY\.md$|package\.json$)/.test(name)));
    assert.ok(!sourceFiles.some(name => /(?:^|\/)(?:dist|store-assets|node_modules|\.git)(?:\/|$)|\.zip$|\.DS_Store|screenshot|feedback|input|library/i.test(name)));
  } finally {
    fs.rmSync(temporary, {recursive:true,force:true});
  }
});
