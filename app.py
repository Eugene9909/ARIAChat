"""
ARIA Chat — backend (see architecture.txt for setup and OOP overview).
Local conversational replies — no external LLM APIs.
"""

import json
import os
import random
import re
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from dotenv import load_dotenv
from flask import Flask, jsonify, request, session
from flask_cors import CORS

load_dotenv()

_FEEDBACK_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "feedback.jsonl")

_GREETINGS = {
    "friendly": (
        "Hi — I'm ARIA. I'm here to listen and help however I can. "
        "What's going on today, or what's on your mind?"
    ),
    "technical": (
        "Hello. I'm ARIA in technical mode. Tell me what you're building, debugging, or deciding — "
        "I'll walk through it with clear steps and assumptions."
    ),
    "creative": (
        "Hey there — ARIA here, creative mode. Whether it's a story, a pitch, or a half-formed idea, "
        "toss it my way and we'll shape it together."
    ),
}


def _session_greeting(kind: str) -> str:
    k = (kind or "friendly").lower().strip()
    return _GREETINGS.get(k, _GREETINGS["friendly"])


def _snippet(text: str, max_len: int = 100) -> str:
    t = text.strip()
    if len(t) <= max_len:
        return t
    return t[: max_len - 1].rstrip() + "…"


def _synthesize_reply(persona: str, user_message: str, turn_index: int) -> str:
    """Build a natural reply that reflects the user's words (local heuristic, no API)."""
    raw = user_message.strip()
    u = raw.lower()
    s = _snippet(raw, 140)

    # Greetings
    if re.match(
        r"^(hi|hello|hey|good\s+(morning|afternoon|evening)|howdy|greetings)\b",
        u,
    ):
        if persona == "technical":
            return (
                "Hi — thanks for jumping in. When you're ready, describe the system, error, or decision you're facing "
                "and what you've already tried."
            )
        if persona == "creative":
            return (
                "Hey! Nice to meet you. What are you making, imagining, or stuck on? "
                "Even a rough sketch in words is enough to start."
            )
        return (
            "Hello — I'm really glad you're here. Take your time; "
            "tell me whatever feels most important right now."
        )

    if re.search(r"\b(thanks|thank you|thx|appreciate it)\b", u):
        if persona == "technical":
            return "You're welcome. If anything else comes up in the same thread, send it over and we'll trace it."
        if persona == "creative":
            return "Anytime — that's what I'm here for. Come back whenever the next spark hits."
        return "Of course — happy to help. I'm right here if you want to keep going."

    if re.search(r"\b(bye|goodbye|see you|later|cya)\b", u):
        return "Take care — whenever you want to pick this up again, I'll be here."

    if re.search(r"\b(help|stuck|don't know|not sure|confused)\b", u):
        if persona == "technical":
            return (
                f"I hear you on needing direction around “{s}”. "
                "Let's narrow it: what's the single outcome you want in the next step, and what's blocking it right now?"
            )
        if persona == "creative":
            return (
                f"Got it — “{s}” sounds like something we can untangle. "
                "Try naming one constraint (time, audience, or tone) and one thing you're willing to change; we'll build from there."
            )
        return (
            f"It makes sense you'd reach out about that. "
            f"When you think about “{s}”, what would feel like a small win in the next few minutes?"
        )

    # Questions
    if "?" in raw:
        if persona == "technical":
            return (
                f"On “{s}”: I'd break it into inputs, constraints, and a testable hypothesis. "
                "If you share which part is uncertain (requirements, implementation, or tradeoffs), I can go deeper there."
            )
        if persona == "creative":
            return (
                f"Interesting question — “{s}”. "
                "One angle: flip it into a scene or metaphor and see what changes. Want to explore a bolder version or a tighter one first?"
            )
        return (
            f"That's a fair thing to ask. From what you wrote — “{s}” — "
            "I'd say trust your instinct on what matters most, then we can flesh out the rest together."
        )

    # Topic hints
    if re.search(r"\b(code|bug|error|api|deploy|server|python|js|react)\b", u):
        if persona == "technical":
            return (
                f"I see you're in the weeds with something technical around “{s}”. "
                "Walk me through expected vs actual behavior, and any message or stack trace you have."
            )
        if persona == "creative":
            return (
                f"Tech and creativity overlap more than people admit — “{s}”. "
                "What would ‘working beautifully’ look like for you here, not just ‘working’?"
            )
        return (
            f"Sounds like there's a lot under the hood with “{s}”. "
            "If you want, we can slow down and put it in plain language first, then get precise."
        )

    if re.search(r"\b(write|story|idea|design|brand|poem|song)\b", u):
        if persona == "creative":
            return (
                f"Love the energy in “{s}”. "
                "Pick one: do you want to push the idea further, tighten it, or find a completely different direction?"
            )
        if persona == "technical":
            return (
                f"Creative briefs still benefit from structure — “{s}”. "
                "Who's the audience, what's the one takeaway, and what format are you shipping in?"
            )
        return (
            f"There's something worth exploring in “{s}”. "
            "What feeling or message do you want people to walk away with?"
        )

    # Length-aware
    if len(raw) > 280:
        if persona == "technical":
            return (
                f"I read what you sent — there's a lot in there, starting with “{_snippet(raw, 80)}…”. "
                "Which paragraph or decision should we tackle first so we don't miss the point?"
            )
        if persona == "creative":
            return (
                f"You gave me a rich picture — especially “{_snippet(raw, 80)}…”. "
                "What thread do you want to pull on first: character, conflict, or voice?"
            )
        return (
            f"Thank you for sharing so openly — I took in the part about “{_snippet(raw, 80)}…”. "
            "What would help most right now: being heard, sorted into steps, or something else?"
        )

    # Default: mirror + persona voice (rotate slightly with turn)
    variety = turn_index % 3
    if persona == "technical":
        tails = (
            "What constraint matters most: time, correctness, or cost?",
            "What's the smallest experiment that would reduce uncertainty?",
            "If you had to state the risk in one line, what would it be?",
        )
        return f"Understood — “{s}”. {tails[variety]}"
    if persona == "creative":
        tails = (
            "What if we turned up the emotion one notch — what changes?",
            "Is there a second angle hiding in the same idea worth naming?",
            "What would make this feel unmistakably yours?",
        )
        return f"I’m with you on “{s}”. {tails[variety]}"
    tails = (
        "I'm listening — want to add a bit more context, or is there a next step you're hoping for?",
        "That lands. What feels like the natural next piece to unpack?",
        "Thanks for trusting me with that. How would you like me to support you from here?",
    )
    return f"I hear you on “{s}”. {tails[variety]}"


class BaseAssistant(ABC):
    """Base assistant with encapsulated memory/config and polymorphic system prompts."""

    def __init__(self, config=None):
        self.__memory = []
        self.__config = config or {}

    @abstractmethod
    def build_system_prompt(self) -> str:
        pass

    def _persona_key(self) -> str:
        return self.__class__.__name__.replace("Assistant", "").lower()

    def _synthesize(self, user_message: str) -> str:
        turn = sum(1 for m in self.__memory if m.get("role") == "user")
        return _synthesize_reply(self._persona_key(), user_message, turn)

    def chat(self, user_message: str) -> str:
        self.__memory.append({"role": "user", "content": user_message})
        reply = self._synthesize(user_message)
        self.__memory.append({"role": "assistant", "content": reply})
        return reply


class FriendlyAssistant(BaseAssistant):
    def build_system_prompt(self) -> str:
        return (
            "You are ARIA, a warm, approachable assistant. Use clear, encouraging "
            "language. Keep answers helpful and concise unless the user asks for depth."
        )


class TechnicalAssistant(BaseAssistant):
    def build_system_prompt(self) -> str:
        return (
            "You are ARIA, a technical assistant. Prefer precise terminology, "
            "structured explanations, and actionable steps. Mention assumptions explicitly."
        )


class CreativeAssistant(BaseAssistant):
    def build_system_prompt(self) -> str:
        return (
            "You are ARIA, a creative assistant. Offer imaginative ideas, vivid "
            "language, and optional alternatives. Stay constructive and on-topic."
        )


def create_assistant(kind: str) -> BaseAssistant:
    key = (kind or "friendly").lower().strip()
    if key == "technical":
        return TechnicalAssistant()
    if key == "creative":
        return CreativeAssistant()
    return FriendlyAssistant()


app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get(
    "FLASK_SECRET_KEY", "aria-dev-secret-change-for-production"
)
_dev_origins = [
    f"http://{host}:{port}"
    for host in ("127.0.0.1", "localhost")
    for port in range(5173, 5181)
]
CORS(
    app,
    supports_credentials=True,
    resources={
        r"/api/*": {
            "origins": _dev_origins,
            "supports_credentials": True,
            "allow_headers": ["Content-Type"],
        }
    },
)

_sessions: dict[str, BaseAssistant] = {}


def _login_ok(username: str, password: str) -> bool:
    user = (username or "").strip()
    pw = (password or "").strip()
    if not user or not pw:
        return False
    expected_user = os.environ.get("ARIA_LOGIN_USER")
    expected_pass = os.environ.get("ARIA_LOGIN_PASS")
    if expected_user is not None and user != expected_user:
        return False
    if expected_pass is not None and pw != expected_pass:
        return False
    return True


@app.before_request
def _require_session_for_chat_api():
    if request.method == "OPTIONS":
        return None
    path = request.path or ""
    if not path.startswith("/api/"):
        return None
    public = {"/api/health", "/api/login", "/api/auth", "/api/logout"}
    if path in public:
        return None
    if not session.get("logged_in"):
        return jsonify({"error": "Unauthorized"}), 401
    return None


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "service": "aria-chat", "llm": "local_heuristic"})


@app.route("/api/auth", methods=["GET"])
def auth_status():
    if session.get("logged_in"):
        return jsonify({"logged_in": True, "username": session.get("username", "")})
    return jsonify({"logged_in": False})


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username") or ""
    password = data.get("password") or ""
    if not _login_ok(username, password):
        return jsonify({"error": "Invalid username or password"}), 401
    session["logged_in"] = True
    session["username"] = (username or "").strip()
    return jsonify({"ok": True, "username": session["username"]})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop("logged_in", None)
    session.pop("username", None)
    return jsonify({"ok": True})


@app.route("/api/session", methods=["POST"])
def new_session():
    data = request.get_json(silent=True) or {}
    kind = data.get("assistant", "friendly")
    sid = str(uuid.uuid4())
    _sessions[sid] = create_assistant(kind)
    return jsonify(
        {
            "session_id": sid,
            "assistant": kind,
            "greeting": _session_greeting(kind),
        }
    )


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    sid = data.get("session_id")
    message = (data.get("message") or "").strip()
    if not sid or sid not in _sessions:
        return jsonify({"error": "Invalid or missing session_id"}), 400
    if not message:
        return jsonify({"error": "message is required"}), 400

    assistant = _sessions[sid]
    try:
        reply = assistant.chat(message)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify({"reply": reply})


@app.route("/api/assistant", methods=["POST"])
def set_assistant():
    data = request.get_json(silent=True) or {}
    sid = data.get("session_id")
    kind = data.get("assistant", "friendly")
    if not sid or sid not in _sessions:
        return jsonify({"error": "Invalid or missing session_id"}), 400
    new_bot = create_assistant(kind)
    _sessions[sid] = new_bot
    return jsonify(
        {
            "session_id": sid,
            "assistant": kind,
            "greeting": _session_greeting(kind),
        }
    )


@app.route("/api/feedback", methods=["POST"])
def feedback():
    data = request.get_json(silent=True) or {}
    text = (data.get("message") or "").strip()
    if len(text) < 5:
        return jsonify({"error": "Please share a little more detail (at least a few words)."}), 400
    if len(text) > 8000:
        text = text[:8000]
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "username": session.get("username"),
        "message": text,
    }
    try:
        with open(_FEEDBACK_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except OSError as exc:
        return jsonify({"error": f"Could not save feedback: {exc}"}), 500
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
