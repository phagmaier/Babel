"""Read only the owned synthetic application's actual Linux AT-SPI tree.
No screenreader inference: names/roles exposed via D-Bus are the limited evidence.
"""
import json
import re
import subprocess
from pathlib import Path


def inspect(d, label):
    def buscall(address, destination, path, method, *args):
        return subprocess.check_output(['gdbus','call','--address',address,'--dest',destination,'--object-path',path,'--method',method,*args],text=True,timeout=5)
    address_output=subprocess.check_output(['gdbus','call','--session','--dest','org.a11y.Bus','--object-path','/org/a11y/bus','--method','org.a11y.Bus.GetAddress'],text=True,timeout=5)
    address=re.search("'([^']+)'",address_output).group(1)
    parents={int(pid):int(parent) for pid,parent in (line.split() for line in subprocess.check_output(['ps','-eo','pid,ppid'],text=True).splitlines()[1:])}
    def owned(pid):
        seen=set()
        while pid and pid not in seen:
            if pid==d.DRIVER.pid:return True
            seen.add(pid);pid=parents.get(pid,0)
        return False
    permissions={}
    def owns_bus(bus):
        if bus not in permissions:
            output=buscall(address,'org.freedesktop.DBus','/org/freedesktop/DBus','org.freedesktop.DBus.GetConnectionUnixProcessID',bus)
            pid=int(re.search(r'uint32 (\d+)',output).group(1));permissions[bus]=owned(pid)
        return permissions[bus]
    def children(bus,path):
        result=buscall(address,bus,path,'org.a11y.atspi.Accessible.GetChildren')
        return re.findall(r"\('([^']+)', (?:objectpath )?'([^']+)'\)",result)
    roots=children('org.a11y.atspi.Registry','/org/a11y/atspi/accessible/root')
    queue=[(bus,path,0) for bus,path in roots if owns_bus(bus)]
    observations=[];seen=set()
    constants=Path('/usr/include/at-spi-2.0/atspi/atspi-constants.h').read_text()
    enum=constants[constants.index('  ATSPI_ROLE_INVALID,'):constants.index('} AtspiRole;')]
    role_symbols=re.findall(r'^\s*(ATSPI_ROLE_[A-Z0-9_]+)',enum,re.M)
    while queue and len(observations)<500:
        bus,path,depth=queue.pop(0)
        if (bus,path) in seen or not owns_bus(bus):continue
        seen.add((bus,path))
        try:
            properties=buscall(address,bus,path,'org.freedesktop.DBus.Properties.GetAll','org.a11y.atspi.Accessible')
            role=buscall(address,bus,path,'org.a11y.atspi.Accessible.GetRoleName')
            role_number=int(re.search(r'uint32 (\d+)',buscall(address,bus,path,'org.a11y.atspi.Accessible.GetRole')).group(1))
            observations.append({'bus':bus,'path':path,'depth':depth,'properties':properties.strip(),'role':role.strip(),'roleNumber':role_number,'roleSymbol':role_symbols[role_number] if role_number<len(role_symbols) else 'unknown'})
            if depth<16:queue.extend((cb,cp,depth+1) for cb,cp in children(bus,path))
        except (subprocess.CalledProcessError,subprocess.TimeoutExpired):pass
    result={'label':label,'ownedRoots':len([1 for bus,_ in roots if permissions.get(bus)]),'nodes':observations,'truncated':bool(queue),'screenreader':'No Orca installed; speech, announcement timing and screenreader shortcut coverage remain unverified.'}
    (d.ROOT/('commands-atspi-'+label+'.json')).write_text(json.dumps(result,indent=2))
    print('OWNED ATSPI',label,len(observations),flush=True)
    return result
