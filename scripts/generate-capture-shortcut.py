#!/usr/bin/env python3
"""Generate docs/guides/ios/Podcaster-Capture.shortcut (unsigned bplist)."""

from __future__ import annotations

import plistlib
import uuid
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "docs/guides/ios/Podcaster-Capture.shortcut"


def uid() -> str:
    return str(uuid.uuid4()).upper()


def tt(text: str) -> dict:
    return {"Value": {"string": text, "WFSerializationType": "WFTextTokenString"}, "WFSerializationType": "WFTextTokenString"}


def attach(output_uuid: str, output_name: str) -> dict:
    return {
        "Value": {
            "OutputUUID": output_uuid,
            "Type": "ActionOutput",
            "OutputName": output_name,
        },
        "WFSerializationType": "WFTextTokenAttachment",
    }


def dict_item_str(key: str, value: str) -> dict:
    return {"WFKey": tt(key), "WFItemType": 0, "WFValue": tt(value)}


def dict_item_attach(key: str, output_uuid: str, output_name: str) -> dict:
    return {
        "WFKey": tt(key),
        "WFItemType": 0,
        "WFValue": attach(output_uuid, output_name),
    }


def action(identifier: str, params: dict) -> dict:
    p = dict(params)
    if "UUID" not in p:
        p["UUID"] = uid()
    return {"WFWorkflowActionIdentifier": identifier, "WFWorkflowActionParameters": p}


def build() -> dict:
    u_base = uid()
    u_token = uid()
    u_web = uid()
    u_title = uid()
    u_url = uid()
    u_post = uid()

    actions = [
        action(
            "is.workflow.actions.gettext",
            {
                "UUID": u_base,
                "WFTextActionText": tt("https://YOUR-VERCEL-HOST"),
                "CustomOutputName": "API Base",
            },
        ),
        action(
            "is.workflow.actions.gettext",
            {
                "UUID": u_token,
                "WFTextActionText": tt("PASTE_CAPTURE_API_TOKEN"),
                "CustomOutputName": "API Token",
            },
        ),
        action(
            "is.workflow.actions.getwebpagecontents",
            {
                "UUID": u_web,
                "WFInput": {"Type": "ExtensionInput"},
                "CustomOutputName": "Page Body",
            },
        ),
        action(
            "is.workflow.actions.properties.safari.webpage",
            {
                "UUID": u_title,
                "WFContentItemPropertyName": "Page Title",
                "WFInput": {"Type": "ExtensionInput"},
                "CustomOutputName": "Page Title",
            },
        ),
        action(
            "is.workflow.actions.properties.safari.webpage",
            {
                "UUID": u_url,
                "WFContentItemPropertyName": "Page URL",
                "WFInput": {"Type": "ExtensionInput"},
                "CustomOutputName": "Page URL",
            },
        ),
        action(
            "is.workflow.actions.downloadurl",
            {
                "UUID": u_post,
                "WFURL": {
                    "Value": {
                        "attachmentsByRange": {"{0, 1}": attach(u_base, "API Base")},
                        "string": "\ufffc/api/capture",
                    },
                    "WFSerializationType": "WFTextTokenString",
                },
                "WFHTTPMethod": "POST",
                "WFHTTPBodyType": "JSON",
                "WFJSONValues": {
                    "Value": {
                        "WFDictionaryFieldValueItems": [
                            dict_item_attach("title", u_title, "Page Title"),
                            dict_item_attach("content", u_web, "Page Body"),
                            dict_item_attach("url", u_url, "Page URL"),
                            dict_item_str("collection", "web-clips"),
                            dict_item_str("podcast", "none"),
                        ]
                    },
                    "WFSerializationType": "WFDictionaryFieldValue",
                },
                "WFHTTPHeaders": {
                    "Value": {
                        "WFDictionaryFieldValueItems": [
                            dict_item_str("Content-Type", "application/json"),
                            {
                                "WFKey": tt("Authorization"),
                                "WFItemType": 0,
                                "WFValue": {
                                    "Value": {
                                        "attachmentsByRange": {
                                            "{0, 1}": tt("Bearer "),
                                            "{1, 1}": attach(u_token, "API Token"),
                                        },
                                        "string": "\ufffc\ufffc",
                                    },
                                    "WFSerializationType": "WFTextTokenString",
                                },
                            },
                        ]
                    },
                    "WFSerializationType": "WFDictionaryFieldValue",
                },
                "CustomOutputName": "Capture Response",
            },
        ),
        action(
            "is.workflow.actions.showresult",
            {
                "Text": attach(u_post, "Capture Response"),
            },
        ),
    ]

    return {
        "WFWorkflowClientVersion": "2702",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowName": "Podcaster Capture",
        "WFWorkflowDescription": "Safari 共有 → POST /api/capture（web-clips, podcast: none）",
        "WFWorkflowTypes": ["ActionExtension"],
        "WFWorkflowInputContentItemClasses": [
            "WFSafariWebPageContentItem",
            "WFURLContentItem",
            "WFStringContentItem",
        ],
        "WFWorkflowImportQuestions": [
            {
                "ActionIndex": 0,
                "Category": "Parameter",
                "DefaultValue": "https://YOUR-VERCEL-HOST",
                "ParameterKey": "WFTextActionText",
                "Text": "Capture API のベース URL（末尾スラッシュなし）",
            },
            {
                "ActionIndex": 1,
                "Category": "Parameter",
                "DefaultValue": "",
                "ParameterKey": "WFTextActionText",
                "Text": "CAPTURE_API_TOKEN（Vercel と同じ Bearer トークン）",
            },
        ],
        "WFWorkflowActions": actions,
    }


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = build()
    OUT.write_bytes(plistlib.dumps(data, fmt=plistlib.FMT_BINARY))
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
