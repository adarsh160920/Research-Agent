"""
Research Agentic AI Application — Flask Backend
Model: qwen/qwen3.8-27b via Groq API
Security: API key loaded from environment variable only.
"""

import os
import json
import uuid
import logging
import threading
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

from research_agent import ResearchAgent
from document_processor import DocumentProcessor

# ── Load environment variables (GROQ_API_KEY never touches the frontend) ──
load_dotenv()

# ── Logging ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s"
)
logger = logging.getLogger(__name__)

# ── Flask App ─────────────────────────────────────────────────────────────
# ── Feedback file lock (thread-safe writes) ───────────────────────────────
_feedback_lock = threading.Lock()

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
ALLOWED_EXTENSIONS = {"pdf", "txt", "md"}
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ── Validate API Key at startup ───────────────────────────────────────────
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
if not GROQ_API_KEY:
    logger.warning(
        "GROQ_API_KEY is not set. Please set it in your .env file. "
        "The application will start but API calls will fail."
    )

agent = ResearchAgent(api_key=GROQ_API_KEY)
doc_processor = DocumentProcessor()


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ── Routes ────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/health", methods=["GET"])
def health():
    # Just check key presence — no API call to avoid wasting rate limit quota
    key_present = bool(GROQ_API_KEY)
    key_valid = key_present  # assume valid if present; errors surface on first real call
    key_message = "API key is configured." if key_present else "GROQ_API_KEY not set."
    return jsonify({
        "status": "ok",
        "model": "qwen/qwen3.8-27b",
        "api_key_configured": key_present,
        "api_key_valid": key_valid,
        "message": key_message
    })


@app.route("/api/analyze", methods=["POST"])
def analyze():
    """
    Full research analysis endpoint.
    Accepts: topic, domain, keywords, objectives, notes, uploaded_text
    Returns: structured research insights, gaps, trends, recommendations
    """
    try:
        data = request.get_json(force=True) or {}
        topic = str(data.get("topic", "")).strip()
        domain = str(data.get("domain", "")).strip()
        keywords = str(data.get("keywords", "")).strip()
        objectives = str(data.get("objectives", "")).strip()
        notes = str(data.get("notes", "")).strip()
        uploaded_text = str(data.get("uploaded_text", "")).strip()

        if not topic:
            return jsonify({"error": "Research topic is required."}), 400

        result = agent.full_analysis(
            topic=topic,
            domain=domain,
            keywords=keywords,
            objectives=objectives,
            notes=notes,
            uploaded_text=uploaded_text,
        )
        return jsonify(result)

    except Exception as e:
        logger.exception("Error in /api/analyze")
        return jsonify({"error": "Analysis failed. Please check your inputs and try again.", "detail": str(e)}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Conversational agent endpoint.
    Accepts: query, context (topic/domain/keywords)
    Returns: agent response with disclaimer
    """
    try:
        data = request.get_json(force=True) or {}
        query = str(data.get("query", "")).strip()
        context = data.get("context", {})

        if not query:
            return jsonify({"error": "Query is required."}), 400

        response = agent.chat(query=query, context=context)
        return jsonify(response)

    except Exception as e:
        logger.exception("Error in /api/chat")
        return jsonify({"error": "Chat failed. Please try again.", "detail": str(e)}), 500


@app.route("/api/upload", methods=["POST"])
def upload():
    """
    Document upload endpoint.
    Accepts: file (PDF, TXT, MD) via multipart/form-data
    Returns: extracted text and basic summary
    """
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file provided."}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "No file selected."}), 400

        if not allowed_file(file.filename):
            return jsonify({"error": "File type not allowed. Upload PDF, TXT, or MD files only."}), 400

        filename = secure_filename(file.filename)
        unique_name = f"{uuid.uuid4().hex}_{filename}"
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)
        file.save(save_path)

        # Extract text from the document
        extracted = doc_processor.extract(save_path)

        # Clean up uploaded file after processing
        try:
            os.remove(save_path)
        except OSError:
            pass

        return jsonify({
            "filename": filename,
            "extracted_text": extracted["text"],
            "word_count": extracted["word_count"],
            "preview": extracted["preview"],
            "status": "success"
        })

    except Exception as e:
        logger.exception("Error in /api/upload")
        return jsonify({"error": "File processing failed.", "detail": str(e)}), 500


@app.route("/api/dashboard", methods=["POST"])
def dashboard():
    """
    Generate structured dashboard data from analysis results.
    Accepts: analysis_text, topic, keywords
    Returns: JSON data for charts and knowledge graph
    """
    try:
        data = request.get_json(force=True) or {}
        analysis_text = str(data.get("analysis_text", "")).strip()
        topic = str(data.get("topic", "")).strip()
        keywords = str(data.get("keywords", "")).strip()

        if not analysis_text:
            return jsonify({"error": "Analysis text is required."}), 400

        dashboard_data = agent.generate_dashboard_data(
            analysis_text=analysis_text,
            topic=topic,
            keywords=keywords
        )
        return jsonify(dashboard_data)

    except Exception as e:
        logger.exception("Error in /api/dashboard")
        return jsonify({"error": "Dashboard generation failed.", "detail": str(e)}), 500


@app.route("/api/feedback", methods=["POST"])
def feedback():
    """
    Save user feedback (thumbs up/down) on a chat response.
    Stored in feedback.jsonl — one JSON record per line.
    The agent reads this file to learn preferred response patterns.
    """
    try:
        data = request.get_json(force=True) or {}
        vote = str(data.get("vote", "")).strip()
        if vote not in ("up", "down"):
            return jsonify({"error": "vote must be 'up' or 'down'"}), 400

        record = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "msg_id": str(data.get("msg_id", ""))[:64],
            "vote": vote,
            "query": str(data.get("query", ""))[:500],
            "response": str(data.get("response", ""))[:2000],
            "context": data.get("context", {}),
        }

        feedback_path = os.path.join(os.path.dirname(__file__), "feedback.jsonl")
        with _feedback_lock:
            with open(feedback_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")

        logger.info(f"Feedback saved: {vote} for msg {record['msg_id'][:12]}")
        return jsonify({"status": "ok"})

    except Exception as e:
        logger.exception("Error in /api/feedback")
        return jsonify({"error": "Failed to save feedback.", "detail": str(e)}), 500


@app.route("/static/<path:path>")
def static_files(path):
    return send_from_directory("static", path)


# ── Error Handlers ────────────────────────────────────────────────────────

@app.errorhandler(413)
def file_too_large(e):
    return jsonify({"error": "File too large. Maximum size is 10 MB."}), 413


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found."}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error."}), 500


# ── Entry Point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    logger.info(f"Starting Research Agentic AI on http://localhost:{port}")
    # use_reloader=False keeps a single stable process (avoids double-spawn on Windows)
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=False, threaded=True)
