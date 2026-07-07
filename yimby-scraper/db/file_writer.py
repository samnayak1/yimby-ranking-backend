import json
from pathlib import Path

OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

def save_json(kind: str, name: str, data: dict):
    filename = (
        OUTPUT_DIR
        / f"{kind}_{name.replace('/', '-').replace(' ', '_')}.json"
    )

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)