import csv
import json
from pathlib import Path


BASE_DIR = Path(__file__).parent
CONTENT_JSON = BASE_DIR / "contents.json"
OUTPUT_DIR = BASE_DIR / "csv"


def write_csv(path: Path, fieldnames, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    # Excel対策: UTF-8 with BOM
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def join_list(values):
    if not values:
        return ""
    return "|".join(values)


def main():
    data = json.loads(CONTENT_JSON.read_text(encoding="utf-8"))

    # meta
    meta_rows = [{"key": k, "value": v} for k, v in data.get("meta", {}).items()]
    write_csv(OUTPUT_DIR / "meta.csv", ["key", "value"], meta_rows)

    # system_messages
    sys_rows = [{"key": k, "value": v} for k, v in data.get("system_messages", {}).items()]
    write_csv(OUTPUT_DIR / "system_messages.csv", ["key", "value"], sys_rows)

    # screens
    screen_rows = []
    for screen_id, screen in data.get("screen_registry", {}).items():
        screen_rows.append({
            "screen_id": screen_id,
            "name": screen.get("name", ""),
            "routes": join_list(screen.get("routes", [])),
            "group": screen.get("group", "")
        })
    write_csv(OUTPUT_DIR / "screens.csv", ["screen_id", "name", "routes", "group"], screen_rows)

    # menus
    menu_rows = []
    for menu_id, menu in data.get("menus", {}).items():
        options = menu.get("options", [])
        if not options:
            menu_rows.append({
                "menu_id": menu_id,
                "message": menu.get("message", ""),
                "option_label": "",
                "option_next_state": "",
                "option_order": ""
            })
            continue
        for idx, opt in enumerate(options, 1):
            menu_rows.append({
                "menu_id": menu_id,
                "message": menu.get("message", "") if idx == 1 else "",
                "option_label": opt.get("label", ""),
                "option_next_state": opt.get("next_state", ""),
                "option_order": idx
            })
    write_csv(
        OUTPUT_DIR / "menus.csv",
        ["menu_id", "message", "option_label", "option_next_state", "option_order"],
        menu_rows
    )

    # content_items
    item_rows = []
    link_rows = []
    related_rows = []
    for item_id, item in data.get("content_items", {}).items():
        item_rows.append({
            "id": item_id,
            "title": item.get("title", ""),
            "body": item.get("body", ""),
            "category": item.get("category", ""),
            "screens": join_list(item.get("screens", [])),
            "keywords": join_list(item.get("keywords", [])),
            "priority": item.get("priority", 0)
        })
        for idx, link in enumerate(item.get("links", []), 1):
            link_rows.append({
                "content_id": item_id,
                "label": link.get("label", ""),
                "url": link.get("url", ""),
                "order": idx
            })
        for idx, related_id in enumerate(item.get("related", []), 1):
            related_rows.append({
                "content_id": item_id,
                "related_id": related_id,
                "order": idx
            })

    write_csv(
        OUTPUT_DIR / "content_items.csv",
        ["id", "title", "body", "category", "screens", "keywords", "priority"],
        item_rows
    )
    write_csv(
        OUTPUT_DIR / "content_links.csv",
        ["content_id", "label", "url", "order"],
        link_rows
    )
    write_csv(
        OUTPUT_DIR / "content_related.csv",
        ["content_id", "related_id", "order"],
        related_rows
    )

    print(f"Exported CSV to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
