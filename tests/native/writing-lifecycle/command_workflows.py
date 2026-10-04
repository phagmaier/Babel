"""M4-14 real WebKit keyboard/GTK menus with disposable authored bytes."""
import hashlib
import json
import subprocess
import time


def run(d):
    report = []
    driver_click=d.click
    def centered_click(label,actions=False):
        prefix="//div[@aria-label='Screenplay actions']" if actions else ''
        element=d.find(prefix+f"//button[normalize-space(.)={json.dumps(label)}]")
        d.script("arguments[0].scrollIntoView({block:'center'});",[{d.ELEMENT:element}])
        return driver_click(label,actions)
    d.click=centered_click
    source = ('\ufeffTitle: Palette Study\r\n\r\n.INT. LAB ONE - DAY\r\n!A bright café. 🚀\r\n\r\n'
              '.EXT. LAB TWO - NIGHT #20#\r\n!Second scene.\r\n\r\n@ÉVA\r\nHello there.\r\n\r\n# Act Two\r\n\r\n.INT. LAB THREE - DAY\r\n!Last scene.\r\n').encode()
    target = d.ROOT/'files'/'palette.fountain'; target.write_bytes(source)
    sha = hashlib.sha256(source).hexdigest()

    def focus():
        clients = [c for c in d.owned_clients() if c.get('class') == 'babel-desktop']; assert len(clients) == 1
        address = clients[0]['address']; assert address.startswith('0x') and all(c in '0123456789abcdef' for c in address[2:])
        subprocess.run(['hyprctl','dispatch','hl.dsp.focus({ window = "address:'+address+'" })'],check=True,stdout=subprocess.DEVNULL)

    def keys(*args):
        focus(); subprocess.run(['/tmp/wtype', *args], check=True)

    def ready():
        d.wait(lambda: d.script("return document.querySelector('#writing-save')?.disabled===false && [...document.querySelectorAll('.manuscript-outline button')].some(b=>b.textContent.includes('LAB THREE')&&!b.disabled);"), 'Current writing outline/save', timeout=90)

    def palette(query, enter=True):
        # Wait the complete projection after focus return before exposing targets.
        if d.script("return !!document.querySelector('.ProseMirror');"):
            d.wait(lambda:d.script("return [...document.querySelectorAll('.manuscript-outline button')].some(b=>b.textContent.includes('LAB THREE')&&!b.disabled);"),'Current palette navigation frame')
        # Actual compositor key chord, then WebDriver trusted text/key input.
        d.script("document.querySelector('.ProseMirror, #home-new').focus();")
        keys('-M','ctrl','-M','shift','-k','p','-m','shift','-m','ctrl')
        d.wait(lambda:d.script("return document.activeElement?.id==='palette-query';"),'Palette input focus')
        element=d.find('//input[@id="palette-query"]')
        d.command('POST','/element/'+element+'/value',{'text':query})
        d.wait(lambda:d.script("return document.querySelector('#palette-query')?.value===arguments[0];",[query]),'Palette filter')
        if enter: keys('-k','Return')

    # Home and writing reuse the same entry/native application services.
    palette('Open'); d.picker(target); ready()
    assert target.read_bytes()==source
    d.wait(lambda:'Comparing recovery against' not in d.body(),'Initial source comparisons',timeout=60)
    palette('LAB TWO');
    d.wait(lambda:d.script("const s=getSelection();return s.focusNode?.parentElement?.closest('.ProseMirror > p')?.textContent.includes('LAB TWO') && document.activeElement?.classList.contains('ProseMirror');"),'Native scene/caret/focus navigation')
    d.type_text('x'); d.wait(lambda:'xEXT.' in d.editor_text(),'Trusted typing after palette navigation')
    d.type_text('\ue009z\ue000')
    d.click('Save',actions=True); d.audit(target,source); ready()
    report.append('Home palette Open/native picker; current scene navigation returns caret; trusted typing/one Undo preserves BOM/CRLF/Unicode bytes')

    palette('Act Two'); d.wait(lambda:d.script("return getSelection().focusNode?.parentElement?.closest('.ProseMirror > p')?.textContent.includes('Act Two');"),'Section palette target')
    palette('Find'); d.wait(lambda:d.script("return document.activeElement?.matches('.find-panel input[type=search]');"),'Find input focus')
    # Form input keeps its own key: remappable application chords do not hijack it.
    find=d.find('//section[contains(@class,"find-panel")]//input[@type="search"]')
    d.command('POST','/element/'+find+'/value',{'text':'Second'})
    keys('-M','ctrl','-M','shift','-k','p','-m','shift','-m','ctrl')
    assert not d.script("return !!document.querySelector('.command-palette');")
    d.click('Close find'); ready()
    palette('Script Check'); d.wait(lambda:'Export assessment' in d.body(),'Script Check from shared dispatcher'); d.click('Close Script Check')
    palette('Title page'); d.wait(lambda:d.script("return !!document.querySelector('.title-page-panel');"),'Title page from shared dispatcher'); d.click('Close title page')
    palette('Spellcheck'); d.wait(lambda:d.script("return !!document.querySelector('.spellcheck-panel');"),'Spellcheck from palette'); d.click('Close spellcheck')
    palette('Characters and counts'); d.wait(lambda:d.script("return document.activeElement?.getAttribute('aria-label')==='Character focus';"),'Character focus return')
    palette('Outline and scene moves'); d.wait(lambda:d.script("return document.activeElement?.closest('.manuscript-outline');"),'Outline focus')
    report.append('keyboard palette reaches Find/Script Check/title/spellcheck/characters/outline; form shortcut does not steal input')

    # F6 out/back; regular Tab order; Escape/cancel restores prior editor caret.
    d.script("document.querySelector('.ProseMirror').focus();")
    keys('-k','F6'); d.wait(lambda:d.script("return document.activeElement?.id==='writing-save';"),'F6 writing actions')
    keys('-k','F6'); d.wait(lambda:d.script("return document.activeElement?.classList.contains('ProseMirror');"),'F6 returns editor')
    palette('nonexistent',False); keys('-k','Tab'); d.wait(lambda:d.script("return document.activeElement?.textContent==='Cancel palette';"),'Palette Tab containment')
    keys('-k','Tab'); d.wait(lambda:d.script("return document.activeElement?.id==='palette-query';"),'Palette Tab wrap')
    keys('-k','Escape'); d.wait(lambda:d.script("return document.activeElement?.classList.contains('ProseMirror') && !document.querySelector('.command-palette');"),'Escape focus return')
    report.append('real F6/Tab/Enter/Escape focus and no-result cancellation')

    # Remap Save As in the actual production help; native labels update from registry.
    d.script("[...document.querySelectorAll('.editor-controls summary')].find(e=>e.textContent==='Shortcut settings').click();")
    command=d.find('//select[ancestor::label[contains(.,"Command")]]/option[@value="saveAs"]');d.command('POST','/element/'+command+'/click',{})
    binding=d.find('//input[ancestor::label[contains(.,"Shortcut")]]'); d.command('POST','/element/'+binding+'/clear',{}); d.command('POST','/element/'+binding+'/value',{'text':'Mod+K'})
    d.click('Save shortcut');d.wait(lambda:'Shortcuts saved locally.' in d.body(),'Remap stored')
    d.script("document.querySelector('.ProseMirror').focus();window.commandKeys=[];document.addEventListener('keydown',e=>window.commandKeys.push({key:e.key,trusted:e.isTrusted}));")
    keys('-M','ctrl','-k','k','-m','ctrl'); d.picker(None)
    d.wait(lambda:'The native dialog was cancelled. Nothing changed.' in d.body(),'Remapped Save As cancellation'); ready(); d.audit(target,source)
    # Native GTK menu keys and screenshot: inspect actual labels and selection.
    keys('-k','F10','-s','200','-k','Down','-s','200'); time.sleep(.3); d.screenshot('commands-native-menu')
    from command_accessibility import inspect
    tree=inspect(d,'menu'); report.append({'nativeMenuAtspiNodes':len(tree['nodes'])})
    print('NATIVE MENU OPEN', d.script('return window.commandKeys;'),flush=True)
    # Down already selected the first enabled item, Save; next is Save As.
    # Toolkit popup creation/focus is asynchronous. Give each real key a
    # rendered turn rather than send an instantaneous burst before its grab.
    subprocess.run(['/tmp/babel-m3-08-keyboard','command-menu-save-as'],check=True)
    d.picker(None); ready(); d.audit(target,source)
    d.wait(lambda:'The native dialog was cancelled. Nothing changed.' in d.body(),'Native menu Save As cancellation')
    report.append('production remap persisted; Ctrl+K Save As/native picker cancellation; native GTK F10/Down/Enter Save As/picker cancellation; exact source')

    # Native GTK simple IME with palette available: shortcut cannot dismiss IME.
    d.script("document.querySelector('.ProseMirror').focus();window.commandIme=[];for(const kind of ['compositionstart','compositionend'])document.querySelector('.ProseMirror').addEventListener(kind,e=>window.commandIme.push({kind,trusted:e.isTrusted}));")
    focus()
    physical=lambda action: subprocess.run(['/tmp/babel-m3-08-keyboard',action],check=True)
    physical('unicode-start');physical('hex-4');physical('escape')
    d.wait(lambda:len(d.script('return window.commandIme;'))>=2,'Actual IME cancelled')
    assert all(e['trusted'] for e in d.script('return window.commandIme;'))
    report.append({'gtkSimpleIme':d.script('return window.commandIme;')})

    # Actual light palette before the dark/scaled run.
    theme=d.find('//select[@aria-label="Theme"]/option[@value="light"]');d.command('POST','/element/'+theme+'/click',{})
    palette('LAB',False);d.screenshot('commands-light');keys('-k','Escape')
    report.append('native light palette/focus/selection inspected')
    # Actual dark/scaled palette, non-color selected marker and persistent status.
    theme=d.find('//select[@aria-label="Theme"]/option[@value="dark"]');d.command('POST','/element/'+theme+'/click',{})
    zoom=d.find('//select[@aria-label="Writing zoom"]/option[@value="200"]');d.command('POST','/element/'+zoom+'/click',{})
    d.script("document.documentElement.style.zoom='1.5';")
    palette('LAB',False);d.screenshot('commands-dark-200')
    tree=inspect(d,'palette'); report.append({'paletteAtspiNodes':len(tree['nodes'])})
    assert {'ATSPI_ROLE_DIALOG','ATSPI_ROLE_COMBO_BOX','ATSPI_ROLE_LIST_BOX','ATSPI_ROLE_LIST_ITEM'}.issubset({n['roleSymbol'] for n in tree['nodes']})
    assert d.script("const p=document.querySelector('.command-palette');return p.scrollWidth<=p.clientWidth+1 && getComputedStyle(document.querySelector('[aria-selected=\"true\"]'),'::before').content.includes('›');")
    keys('-k','Escape'); d.audit(target,source)
    report.append('dark/200% writing zoom plus synthetic 150% whole-view CSS scaling remains in bounds; explicit selected marker/focus/status')
    palette('LAB',False)
    # Programmatic existing Close control simulates an application interruption
    # while inert; native protection/release still run through production IPC.
    d.script("[...document.querySelectorAll('[aria-label=\"Screenplay actions\"] button')].find(b=>b.textContent==='Close session').click();")
    d.wait(lambda:'Start writing' in d.body(),'Automatic protected native close to Home')
    assert d.script("return !document.querySelector('.command-palette') && !document.querySelector('#close-heading');"), 'Successful file-backed close retires palette without a prompt'
    report.append('programmatic production Close interrupts modal; successful protection closes without a prompt; native protection/release keeps exact bytes')
    d.script("document.documentElement.style.zoom='1';")
    readonly=d.ROOT/'files'/'readonly-palette.fountain'; readonly.write_bytes(source); readonly.chmod(0o400)
    palette('Open'); d.picker(readonly)
    d.wait(lambda:'Save As can preserve a separate copy' in d.body(),'Native read-only ownership')
    assert d.script("return document.querySelector('.ProseMirror').getAttribute('aria-readonly');")=='true'
    d.wait(lambda:d.script("return [...document.querySelectorAll('.manuscript-outline button')].some(b=>b.textContent.includes('LAB THREE')&&!b.disabled);"),'Current read-only navigation')
    palette('Save',False)
    assert d.script("return [...document.querySelectorAll('#palette-options [role=option]')].map(e=>e.childNodes[0].textContent.trim());")==['Save As']
    keys('-k','Escape')
    palette('LAB THREE');print('READONLY SELECTION',d.script("const s=getSelection();return {node:s.focusNode?.nodeName,text:s.focusNode?.textContent,offset:s.focusOffset,parent:s.focusNode?.parentElement?.nodeName,active:document.activeElement?.className};"),flush=True);d.wait(lambda:d.script("return (getSelection().focusNode?.nodeType===1?getSelection().focusNode:getSelection().focusNode?.parentElement)?.closest('.ProseMirror > p')?.textContent.includes('LAB THREE');"),'Read-only palette navigation')
    keys('-M','ctrl','-k','k','-m','ctrl'); d.picker(None)
    d.wait(lambda:'The native dialog was cancelled. Nothing changed.' in d.body(),'Read-only Save As cancellation')
    d.audit(readonly,source); d.close_session()
    report.append('actual read-only source: Save omitted, Save As available/remapped/cancelled, scene navigation permitted; original bytes retained')
    assert target.read_bytes()==source
    (d.ROOT/'commands-result.json').write_text(json.dumps({'sha256':sha,'bytes':len(source),'checks':report,'assistiveTechnology':'AT-SPI inspection recorded separately; no installed Orca/pyatspi screenreader coverage'},indent=2))
    print('M4-14 COMMAND WORKFLOWS PASSED',d.ROOT,json.dumps(report),flush=True)
