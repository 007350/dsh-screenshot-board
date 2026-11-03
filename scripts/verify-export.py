import io, json, zipfile, argparse
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--archive', default='artifacts/handoff.zip')
parser.add_argument('--output', default='artifacts/export-results.json')
args = parser.parse_args()
with zipfile.ZipFile(root / args.archive) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert 'tasks.md' in names and 'board.json' in names and 'handoff.json' in names
    board = json.loads(archive.read('board.json'))
    handoff = json.loads(archive.read('handoff.json'))
    assert board['handoff'] == handoff
    assert handoff['boardId'] == board['id'] and handoff['revision'] == board['revision']
    task_ids = {task['id'] for shot in board['screenshots'] for task in shot['tasks']}
    grouped = [handoff[key] for key in ['executionTaskIds', 'referenceTaskIds', 'clarificationTaskIds', 'omittedTaskIds']]
    assert set().union(*map(set, grouped)) == task_ids
    assert sum(map(len, grouped)) == len(task_ids)
    for shot, entry in zip(board['screenshots'], board['exportedFiles']):
        paths = entry['files']
        for key in ['original', 'annotated', 'after']:
            if paths[key]:
                data = archive.read(paths[key])
                image = Image.open(io.BytesIO(data))
                image.verify()
                image = Image.open(io.BytesIO(data))
                expected = shot['after'] if key == 'after' else shot['original']
                assert image.size == (expected['width'], expected['height'])
    markdown = archive.read('tasks.md').decode('utf-8')
    assert all(title in markdown for title in ['本次执行任务', '待澄清', '仅供参考'])
    result = {'crc': 'passed', 'files': names, 'tasks': len(task_ids), 'execution':len(handoff['executionTaskIds']), 'image_decode': 'passed', 'scope_partition': 'passed'}
    (root / args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))
