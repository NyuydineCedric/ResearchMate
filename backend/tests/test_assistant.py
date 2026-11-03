import base64
import io
import json
import os
import sys
import tempfile
import threading
import unittest
from types import SimpleNamespace
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from openpyxl import Workbook

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


class AssistantApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = server.DB_PATH
        server.DB_PATH = Path(self.temp_dir.name) / "assistant-test.db"
        server.initialize_database()
        self.http_server = ThreadingHTTPServer(("127.0.0.1", 0), server.ResearchMateHandler)
        self.thread = threading.Thread(target=self.http_server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.http_server.server_port}"

    def tearDown(self) -> None:
        self.http_server.shutdown()
        self.http_server.server_close()
        self.thread.join(timeout=5)
        server.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def request_json(
        self, path: str, method: str = "GET", payload: dict[str, object] | None = None
    ) -> tuple[int, dict[str, object]]:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request = Request(
            f"{self.base_url}{path}",
            data=body,
            method=method,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urlopen(request, timeout=5) as response:
                return response.status, json.loads(response.read())
        except HTTPError as error:
            return error.code, json.loads(error.read())

    def create_conversation(self, project_id: int | None = None) -> int:
        status, result = self.request_json(
            "/api/assistant/conversations",
            "POST",
            {"projectId": project_id},
        )
        self.assertEqual(status, 201)
        conversation = result["conversation"]
        return conversation["id"]

    def test_missing_gemini_key_returns_configuration_error_without_saving_prompt(self) -> None:
        conversation_id = self.create_conversation()
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            status, result = self.request_json(
                f"/api/assistant/conversations/{conversation_id}/messages",
                "POST",
                {"question": "Explain my research design."},
            )
        self.assertEqual(status, 503)
        self.assertIn("GEMINI_API_KEY", result["error"])
        _, saved = self.request_json(f"/api/assistant/conversations/{conversation_id}")
        self.assertEqual(saved["messages"], [])

    def test_gemini_request_uses_configured_backend_sdk_and_chat_history(self) -> None:
        from google import genai

        client = MagicMock()
        client.models.generate_content.return_value = SimpleNamespace(text="A verified response.")
        messages = [
            {"role": "user", "content": "What is a research question?"},
            {"role": "assistant", "content": "It guides an investigation."},
            {"role": "user", "content": "Can you give an example?"},
        ]
        context = {"project": ["Project: Student wellbeing study."]}
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}):
            with patch.object(genai, "Client", return_value=client) as client_factory:
                answer = server.gemini_answer(messages, context)

        self.assertEqual(answer, "A verified response.")
        self.assertEqual(client_factory.call_args.kwargs["api_key"], "test-key")
        call = client.models.generate_content.call_args
        self.assertEqual(call.kwargs["model"], server.DEFAULT_GEMINI_MODEL)
        contents = call.kwargs["contents"]
        self.assertEqual([item["role"] for item in contents], ["user", "model", "user"])
        self.assertIn("Can you give an example?", contents[-1]["parts"][0]["text"])
        self.assertIn("Student wellbeing study", contents[-1]["parts"][0]["text"])

    def test_chat_turns_persist_and_follow_up_receives_project_context(self) -> None:
        status, project = self.request_json(
            "/api/projects",
            "POST",
            {"title": "Student wellbeing study", "researchArea": "Education"},
        )
        self.assertEqual(status, 201)
        project_id = project["project"]["id"]
        conversation_id = self.create_conversation(project_id)
        requests_seen: list[tuple[list[dict[str, str]], dict[str, object]]] = []

        def fake_gemini(
            messages: list[dict[str, str]], context: dict[str, object]
        ) -> str:
            requests_seen.append((messages, context))
            return f"Grounded response {len(requests_seen)}."

        with patch.object(server, "gemini_answer", side_effect=fake_gemini):
            self.assertEqual(
                self.request_json(
                    f"/api/assistant/conversations/{conversation_id}/messages",
                    "POST",
                    {"question": "How should I frame my question?"},
                )[0],
                200,
            )
            status, result = self.request_json(
                f"/api/assistant/conversations/{conversation_id}/messages",
                "POST",
                {"question": "Can you clarify that?"},
            )

        self.assertEqual(status, 200)
        self.assertEqual(len(requests_seen[1][0]), 3)
        self.assertTrue(any("Student wellbeing study" in item for item in requests_seen[0][1]["project"]))
        self.assertEqual([message["role"] for message in result["messages"]], [
            "user", "assistant", "user", "assistant"
        ])
        self.assertEqual(result["conversation"]["title"], "How should I frame my question?")
        _, reopened = self.request_json(f"/api/assistant/conversations/{conversation_id}")
        self.assertEqual(reopened["messages"], result["messages"])

    def test_ai_questionnaire_generation_returns_an_unsaved_editable_draft(self) -> None:
        status, project = self.request_json(
            "/api/projects",
            "POST",
            {
                "title": "Student wellbeing study",
                "researchArea": "Education",
                "description": "Explore study habits and wellbeing.",
            },
        )
        self.assertEqual(status, 201)
        project_id = project["project"]["id"]
        draft = {
            "title": "Study Habits and Wellbeing",
            "items": [
                {"prompt": "How often do you plan your study time?", "type": "text", "options": [], "required": False},
                {"prompt": "How manageable is your weekly workload?", "type": "scale", "options": [
                    "Very difficult", "Difficult", "Neither difficult nor manageable", "Manageable", "Very manageable"
                ], "required": True},
                {"prompt": "Where do you usually study?", "type": "multiple-choice", "options": [
                    "At home", "At a library", "On campus", "Other"
                ], "required": False},
            ],
        }
        with patch.object(server, "gemini_questionnaire", return_value=draft) as generate:
            status, result = self.request_json(
                "/api/questionnaires/generate",
                "POST",
                {
                    "topic": "Study habits and student wellbeing",
                    "projectId": project_id,
                    "questionCount": 3,
                    "questionStyle": "mixed",
                },
            )

        self.assertEqual(status, 200)
        self.assertEqual(result["draft"]["title"], draft["title"])
        self.assertEqual(result["draft"]["projectId"], project_id)
        self.assertEqual(len(result["draft"]["items"]), 3)
        self.assertEqual([item["id"] for item in result["draft"]["items"]], [1, 2, 3])
        generate.assert_called_once_with(
            "Study habits and student wellbeing",
            {
                "title": "Student wellbeing study",
                "researchArea": "Education",
                "description": "Explore study habits and wellbeing.",
            },
            3,
            "mixed",
        )
        _, saved = self.request_json("/api/questionnaires")
        self.assertEqual(saved["questionnaires"], [])

    def test_ai_questionnaire_generation_rejects_invalid_count_before_calling_gemini(self) -> None:
        with patch.object(server, "gemini_questionnaire") as generate:
            status, result = self.request_json(
                "/api/questionnaires/generate",
                "POST",
                {"topic": "Study habits", "questionCount": 2},
            )

        self.assertEqual(status, 400)
        self.assertIn("3 to 20", result["error"])
        generate.assert_not_called()

    def test_gemini_questionnaire_uses_configured_model_and_json_response_mode(self) -> None:
        from google import genai

        generated = {
            "title": "Study habits",
            "items": [
                {"prompt": "How often do you study?", "type": "text", "options": [], "required": False}
            ],
        }
        client = MagicMock()
        client.models.generate_content.return_value = SimpleNamespace(text=json.dumps(generated))
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key", "GEMINI_MODEL": "test-model"}):
            with patch.object(genai, "Client", return_value=client) as client_factory:
                result = server.gemini_questionnaire("Study habits", None, 1, "text")

        self.assertEqual(result, generated)
        self.assertEqual(client_factory.call_args.kwargs["api_key"], "test-key")
        call = client.models.generate_content.call_args
        self.assertEqual(call.kwargs["model"], "test-model")
        self.assertEqual(call.kwargs["config"].response_mime_type, "application/json")
        self.assertIn("Study habits", call.kwargs["contents"])

    def test_ai_questionnaire_generation_reports_missing_gemini_key(self) -> None:
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            status, result = self.request_json(
                "/api/questionnaires/generate",
                "POST",
                {"topic": "Study habits", "questionCount": 3},
            )

        self.assertEqual(status, 503)
        self.assertIn("GEMINI_API_KEY", result["error"])
        _, saved = self.request_json("/api/questionnaires")
        self.assertEqual(saved["questionnaires"], [])

    def test_csv_dataset_returns_preview_quality_and_expected_statistics(self) -> None:
        status, result = self.request_json(
            "/api/datasets",
            "POST",
            {
                "sourceName": "survey.csv",
                "csv": "score,group\n1,A\n2,B\n3,A\n4,B\n4,B\n,C\n",
            },
        )
        self.assertEqual(status, 201)
        dataset = result["dataset"]
        self.assertEqual(dataset["rowCount"], 6)
        self.assertEqual(dataset["columnCount"], 2)
        self.assertEqual(len(dataset["sampleRows"]), 5)
        self.assertEqual(dataset["duplicateRows"], 1)
        self.assertTrue(any("duplicate row" in item for item in dataset["qualityWarnings"]))
        self.assertTrue(any("score has 1 missing" in item for item in dataset["qualityWarnings"]))

        score = next(item for item in dataset["columnStats"] if item["name"] == "score")
        self.assertEqual(score["kind"], "numeric")
        self.assertEqual(score["count"], 5)
        self.assertAlmostEqual(score["mean"], 2.8)
        self.assertAlmostEqual(score["variance"], 1.7)
        self.assertAlmostEqual(score["standardDeviation"], 1.7**0.5)
        self.assertEqual(score["quartiles"], {"q1": 2.0, "q2": 3.0, "q3": 4.0})

        group = next(item for item in dataset["columnStats"] if item["name"] == "group")
        self.assertEqual(group["kind"], "categorical")
        self.assertEqual(group["unique"], 3)
        self.assertEqual(group["frequencies"][0], {
            "value": "B",
            "count": 3,
            "percentage": 50.0,
        })

    def test_xlsx_dataset_upload_is_parsed_and_analyzed(self) -> None:
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.append(["hours", "year"])
        worksheet.append([2.5, "first"])
        worksheet.append([3.5, "second"])
        contents = io.BytesIO()
        workbook.save(contents)
        encoded = base64.b64encode(contents.getvalue()).decode("ascii")

        status, result = self.request_json(
            "/api/datasets",
            "POST",
            {"sourceName": "student-survey.xlsx", "workbookBase64": encoded},
        )
        self.assertEqual(status, 201)
        dataset = result["dataset"]
        self.assertEqual(dataset["rowCount"], 2)
        self.assertEqual(dataset["sampleRows"][0], {"hours": "2.5", "year": "first"})
        self.assertEqual(dataset["columnStats"][0]["mean"], 3.0)

    def test_dataset_upload_rejects_unsupported_and_invalid_excel_files(self) -> None:
        status, unsupported = self.request_json(
            "/api/datasets",
            "POST",
            {"sourceName": "survey.xls", "csv": "x\n1"},
        )
        self.assertEqual(status, 400)
        self.assertIn("Only CSV and Excel", unsupported["error"])

        status, invalid = self.request_json(
            "/api/datasets",
            "POST",
            {"sourceName": "survey.xlsx", "workbookBase64": base64.b64encode(b"not excel").decode()},
        )
        self.assertEqual(status, 400)
        self.assertIn("invalid", invalid["error"])


if __name__ == "__main__":
    unittest.main()
