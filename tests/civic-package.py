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
    catalog_path = root / 'public/assets/civic/catalog.json'
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
print('Rectangular packaging, alpha-crop anchors, footprint and lighting mismatch rejection pass.')
