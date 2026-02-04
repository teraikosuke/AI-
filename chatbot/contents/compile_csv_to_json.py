import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))

from backend.content_repo import ContentRepository  # noqa: E402


def main():
    repo = ContentRepository()
    data = repo._load_from_csv()
    output = Path(__file__).parent / "contents.json"
    output.write_text(json.dumps(data, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")
    print(f"Generated JSON: {output}")


if __name__ == "__main__":
    main()
