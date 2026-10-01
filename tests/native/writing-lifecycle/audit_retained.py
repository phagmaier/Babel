"""Independent read-only checksum/ref inventory of successful native roots.
No application parser or native service is imported. Oracles remain in scenarios.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess


def digest(data):
    return hashlib.sha256(data).hexdigest()


def frames(path):
    data = path.read_bytes(); offset = 0; report = []
    while offset < len(data):
        assert data[offset:offset+8] == b'BBLREC01', path
        schema, metadata_length, source_length = struct.unpack_from('<IIQ', data, offset+8)
        assert schema == 1, path
        end = offset + 24 + metadata_length + source_length
        assert end + 32 <= len(data), path
        assert hashlib.sha256(data[offset:end]).digest() == data[end:end+32], path
        metadata = json.loads(data[offset+24:offset+24+metadata_length])
        source = data[offset+24+metadata_length:end]
        assert digest(source) == metadata['sourceSha256'], path
        report.append({'version': metadata['version'], 'generation': metadata['generation'],
                       'bytes': len(source), 'sha256': digest(source)})
        offset = end + 32
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    reports = []
    git_env = dict(os.environ, GIT_CONFIG_GLOBAL='/dev/null', GIT_CONFIG_SYSTEM='/dev/null')
    for run in json.loads(args.manifest.read_text()):
        if run['exitCode'] != 0 or run.get('runtimeCrashLines'): continue
        root = Path(run['artifacts']).resolve(strict=True)
        assert root.name.startswith('babel-writing-'), root
        report = {'mode': run['mode'], 'filesystem': run['filesystem'], 'root': str(root),
                  'frames': {}, 'snapshots': [], 'safetyRefs': [], 'previousSource': []}
        for path in root.rglob('*'):
            if not path.is_file() or path.is_symlink(): continue
            if path.suffix == '.journal' or (path.suffix == '.previous' and path.parent.name == 'recovery') or (path.name == 'confirmed' and path.parent.parent.name == 'source-save'):
                report['frames'][str(path.relative_to(root))] = frames(path)
            elif path.name == 'previous' and path.parent.parent.name == 'source-save':
                data = path.read_bytes()
                report['previousSource'].append({'path': str(path.relative_to(root)), 'bytes': len(data), 'sha256': digest(data)})
            elif path.suffix == '.json' and path.parent.parent.name == 'snapshots':
                envelope = json.loads(path.read_bytes()); record = envelope['record']
                encoded = json.dumps(record, ensure_ascii=False, separators=(',', ':')).encode()
                assert digest(encoded) == envelope['recordSha256'], path
                data = path.with_name(record['sourceSha256'] + '.fountain').read_bytes()
                assert len(data) == record['byteLength'] and digest(data) == record['sourceSha256'], path
                report['snapshots'].append(record)
        for repo in root.rglob('*.git'):
            if not repo.is_dir() or repo.is_symlink(): continue
            cmd = ['git', '--git-dir=' + str(repo)]
            refs = subprocess.check_output([*cmd, 'for-each-ref', '--format=%(refname)', 'refs/safety/'], env=git_env, text=True).splitlines()
            for ref in refs:
                source = subprocess.check_output([*cmd, 'show', ref + ':screenplay.fountain'], env=git_env)
                report['safetyRefs'].append({'repo': str(repo.relative_to(root)), 'ref': ref,
                                             'bytes': len(source), 'sha256': digest(source)})
        reports.append(report)
    args.output.write_text(json.dumps(reports, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'successfulRoots': len(reports), 'frames': sum(len(v) for r in reports for v in r['frames'].values()),
                      'snapshots': sum(len(r['snapshots']) for r in reports),
                      'safetyRefs': sum(len(r['safetyRefs']) for r in reports),
                      'previousSources': sum(len(r['previousSource']) for r in reports)}))


if __name__ == '__main__':
    main()
