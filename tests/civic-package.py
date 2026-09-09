"""Exercise the real packager in an isolated project with rectangular bake metadata."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from PIL import Image, ImageDraw

SOURCE = Path(__file__).resolve().parents[1] / 'tools/civic_art/package.py'
with tempfile.TemporaryDirectory() as scratch:
    root = Path(scratch)
    tool = root / 'tools/civic_art'
    tool.mkdir(parents=True)
    (root / 'src').mkdir()
    (root / 'src/sunlight-config.json').write_text(json.dumps({'version':'world-v1'}))
    renders = root / 'artifacts/civic-renders'
    renders.mkdir(parents=True)
    shutil.copy(SOURCE, tool / 'package.py')
    (tool / 'registry.json').write_text(json.dumps({'airport': {
        'family': 'transport', 'footprint': {'w': 6, 'h': 5},
        'label': 'Airport', 'description': 'Rectangular test fixture',
    }}))
    image = Image.new('RGBA', (100, 80))
    ImageDraw.Draw(image).polygon([(50, 10), (90, 40), (50, 70), (10, 40)], fill='white')
    image.save(renders / 'fixture.png')
    meta = {'lighting':'world-v1','footprint': {'w': 6, 'h': 5}, 'scale': 3, 'maxHeight': 10, 'frames': {
        f'{state}-{rotation}': {'file': 'fixture.png', 'anchor': [50, 40]}
        for state in ['day', 'night', 'unpowered'] for rotation in range(4)
    }}
    metadata = renders / 'airport.json'
    metadata.write_text(json.dumps(meta))
    run = lambda: subprocess.run([sys.executable, str(tool / 'package.py')], capture_output=True, text=True)
    result = run()
    assert result.returncode == 0, result.stderr
    catalog_path = root / 'public/civic-catalog.json'
    original = catalog_path.read_bytes()
    spec = json.loads(original)['airport']
    assert spec['footprint'] == {'w': 6, 'h': 5} and 'tiles' not in spec
    assert len(spec['frames']) == 12
    assert spec['lighting']=='world-v1'
    frame = spec['frames']['day-0']
    assert frame['anchor'] == [42, 32] and (frame['width'], frame['height']) == (85, 65)
    meta['footprint'] = {'w': 5, 'h': 6}
    metadata.write_text(json.dumps(meta))
    result = run()
    assert result.returncode != 0 and 'footprint differs' in result.stderr
    assert catalog_path.read_bytes() == original
    meta['footprint']={'w':6,'h':5}
    meta['lighting']='screen-v0'
    metadata.write_text(json.dumps(meta))
    result=run()
    assert result.returncode != 0 and 'lighting differs' in result.stderr
    assert catalog_path.read_bytes()==original

# The manifest ships as a string handed to JSON.parse, which the browser reads
# faster than a megabyte of object literal. That form has one way to go wrong: a
# value that ends the string early and turns the rest of the module into whatever
# it happens to spell. Filenames are built from safe ids and hashes, but labels
# and descriptions come from a registry a person edits, so the escaping is
# exercised with the characters that would actually break it.
sys.path.insert(0, str(SOURCE.parent))
from package import write_manifest

hostile = {
    'quote': {'label': "Mayor's Office", 'description': "it's fine"},
    'backslash': {'label': 'back' + chr(92) + 'slash', 'description': 'C:' + chr(92) + 'art'},
    'terminators': {'label': 'line' + chr(0x2028) + 'sep' + chr(0x2029) + 'par', 'description': 'ok'},
    'together': {'label': chr(92) + "' and " + chr(0x2028), 'description': "'; alert(1); '"},
    'unicode': {'label': 'Parc \u00c9cologique \u6771\u4eac', 'description': 'emoji \U0001f3d9'},
}
with tempfile.TemporaryDirectory() as escaping:
    written = Path(escaping) / 'manifest.js'
    write_manifest(written, hostile)

    # One statement, and the payload is a single string literal on it.
    body = [line for line in written.read_text().split(chr(10)) if line and not line.startswith('//')]
    assert len(body) == 1, body
    prefix = "export const CIVIC_SPRITES = JSON.parse('"
    assert body[0].startswith(prefix) and body[0].endswith("');")
    payload = body[0][len(prefix):-3]

    # Nothing outside ASCII survives into the payload, which is what keeps a raw
    # newline or a U+2028 out of a JavaScript string literal.
    assert payload.isascii(), 'the payload must be pure ASCII'
    assert not any(ch in payload for ch in (chr(10), chr(13), chr(0x2028), chr(0x2029)))

    # No unescaped quote can end the literal early.
    assert "'" not in payload.replace(chr(92) + "'", ''), 'a quote escaped the string literal'

    # Undo the JavaScript escaping the way the engine does, in the reverse order,
    # then read what is left as JSON.
    out, i = [], 0
    while i < len(payload):
        if payload[i] == chr(92) and i + 1 < len(payload) and payload[i + 1] in (chr(92), "'"):
            out.append(payload[i + 1]); i += 2
        else:
            out.append(payload[i]); i += 1
    assert json.loads(''.join(out)) == hostile, 'the manifest did not survive the round trip'

# Non-finite numbers would produce a module that throws the moment it is imported
# and a game that never starts.
with tempfile.TemporaryDirectory() as broken:
    for bad in (float('nan'), float('inf'), float('-inf')):
        try:
            write_manifest(Path(broken) / 'manifest.js', {'x': {'height': bad}})
        except ValueError:
            continue
        raise AssertionError(f'{bad} was written into the manifest')

print('Rectangular packaging, alpha-crop anchors, footprint and lighting mismatch rejection, and manifest escaping pass.')
