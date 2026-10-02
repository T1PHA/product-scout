# -*- coding: utf-8 -*-
"""Ajoute un produit analysé en nouvelle colonne de l'onglet "Tests Produits".

Usage : python sheet_export.py <fichier.json>
JSON attendu : {"header": str, "cells": {"<début du libellé de ligne>": {"value": str, "rating": "ok|moyen|not_ok|na"|null}}}
Réutilise le client OAuth du dossier "Scraper prospection".
"""
import json
import os
import sys

SCRAPER_APP = os.environ.get(
    "PS_SHEETS_APP", os.path.join(os.path.expanduser("~"), "Documents", "Scraper prospection", "app")
)
sys.path.insert(0, SCRAPER_APP)
from sheets_client import get_service, SPREADSHEET_ID  # noqa: E402

SHEET = "Tests Produits"
COLORS = {"ok": "#D4EDDA", "moyen": "#FFF3CD", "not_ok": "#F8D7DA"}


def col_letter(n):
    s = ""
    n += 1
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def rgb(h):
    h = h.lstrip("#")
    return {"red": int(h[0:2], 16) / 255, "green": int(h[2:4], 16) / 255, "blue": int(h[4:6], 16) / 255}


def norm(s):
    return s.strip().lower()


def main():
    payload = json.load(open(sys.argv[1], encoding="utf-8"))
    s = get_service()
    meta = s.spreadsheets().get(spreadsheetId=SPREADSHEET_ID, ranges=[SHEET], fields="sheets(properties)").execute()
    sheet_id = meta["sheets"][0]["properties"]["sheetId"]

    header_row = s.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range=f"'{SHEET}'!1:1").execute().get("values", [[]])[0]
    col = len(header_row)  # première colonne libre (0-indexée)
    labels = s.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range=f"'{SHEET}'!A1:A200").execute().get("values", [])
    labels = [r[0] if r else "" for r in labels]

    # Ne remplit que la grille produits (jusqu'à la ligne "Sources" incluse)
    end = next((i for i, l in enumerate(labels) if norm(l).startswith("sources")), len(labels) - 1)
    column = [""] * (end + 1)
    column[0] = payload["header"]
    ratings = {}
    for key, cell in payload["cells"].items():
        for i, l in enumerate(labels[: end + 1]):
            if i > 0 and l and norm(l).startswith(norm(key)) and not column[i]:
                column[i] = cell["value"]
                if cell.get("rating") in COLORS:
                    ratings[i] = cell["rating"]
                break

    letter = col_letter(col)
    s.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{SHEET}'!{letter}1",
        valueInputOption="RAW",
        body={"values": [[v] for v in column]},
    ).execute()

    reqs = [
        {"updateDimensionProperties": {"range": {"sheetId": sheet_id, "dimension": "COLUMNS", "startIndex": col, "endIndex": col + 1},
                                       "properties": {"pixelSize": 230}, "fields": "pixelSize"}},
        {"repeatCell": {"range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": end + 1, "startColumnIndex": col, "endColumnIndex": col + 1},
                        "cell": {"userEnteredFormat": {"wrapStrategy": "WRAP", "verticalAlignment": "TOP", "textFormat": {"fontSize": 10}}},
                        "fields": "userEnteredFormat(wrapStrategy,verticalAlignment,textFormat)"}},
        {"repeatCell": {"range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1, "startColumnIndex": col, "endColumnIndex": col + 1},
                        "cell": {"userEnteredFormat": {"backgroundColor": rgb("#1F2937"), "horizontalAlignment": "CENTER", "verticalAlignment": "MIDDLE", "wrapStrategy": "WRAP",
                                                       "textFormat": {"bold": True, "foregroundColor": rgb("#FFFFFF")}}},
                        "fields": "userEnteredFormat"}},
    ]
    for i, r in ratings.items():
        reqs.append({"repeatCell": {"range": {"sheetId": sheet_id, "startRowIndex": i, "endRowIndex": i + 1, "startColumnIndex": col, "endColumnIndex": col + 1},
                                    "cell": {"userEnteredFormat": {"backgroundColor": rgb(COLORS[r])}}, "fields": "userEnteredFormat.backgroundColor"}})
    s.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={"requests": reqs}).execute()
    print(json.dumps({"ok": True, "column": letter, "url": f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit#gid={sheet_id}"}))


if __name__ == "__main__":
    main()
