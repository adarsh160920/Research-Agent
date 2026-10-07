# Research Agentic AI Application — Development Plan
## Agentic AI SDLC Documentation

> **Model:** `qwen/qwen3.8-27b` via Groq API  
> **Version:** 1.0.0  
> **Date:** 2025  
> **Author:** IBM Bob — Agentic AI SDLC Framework

---

## 1. Problem Statement & Vision

Students, researchers, and professionals face significant challenges in navigating the growing body of academic literature. Manual literature review, gap identification, trend analysis, and reference management are time-consuming and cognitively demanding. 

**Vision:** Develop an intelligent, agentic research companion that accelerates the research workflow from topic exploration to structured insights, while maintaining strict ethical guardrails against fabrication of academic content.

---

## 2. Stakeholder Analysis

| Stakeholder | Role | Primary Need |
|---|---|---|
| Students | End User | Topic exploration, literature summaries, methodology guidance |
| Researchers | End User | Gap identification, trend analysis, reference organization |
| Professionals | End User | Domain-specific insights, structured summaries |
| Academics | Reviewer | Ethical AI use, accurate citations, non-fabrication |
| Institution | Governance | Data privacy, responsible AI compliance |

---

## 3. Requirements Engineering

### 3.1 Functional Requirements

**FR-01 — Research Input Collection**  
- Accept research topic, domain, keywords, objectives, notes, and free-form queries  
- Support multimodal input: text, uploaded notes (TXT/MD), PDF documents  

**FR-02 — AI-Powered Research Analysis**  
- Literature review generation and summarization  
- Research gap identification  
- Emerging trends analysis  
- Future research direction suggestions  
- Methodology suggestions and research planning  
- Research topic refinement  
- Keyword and search-query generation  
- Research paper comparison  

**FR-03 — Agent Assistance**  
- Conversational agent for research queries  
- Context-aware responses based on user's domain/topic/keywords  
- Personalized recommendations  

**FR-04 — Research Dashboard**  
- Topic cluster visualization  
- Key concept relationship maps (knowledge graph style)  
- Research trend charts  
- Citation/reference display  
- Research gap summaries  
- Structured findings panels  

**FR-05 — Document Processing**  
- Extract text from uploaded PDFs  
- Process plain text / markdown notes  
- Summarize extracted content  
- Identify key findings and themes  

### 3.2 Non-Functional Requirements

**NFR-01 — Security**  
- API key stored exclusively in server-side environment variable (GROQ_API_KEY)  
- No secrets in frontend code or version control  
- Input sanitization against prompt injection  
- Untrusted input handling for all user and document content  

**NFR-02 — Ethics & Reliability**  
- Zero fabrication of papers, authors, journals, DOI numbers, or statistics  
- Clear distinction between AI-generated analysis and verified information  
- Disclaimer on all AI-generated outputs  
- HAM (Helpful, Accurate, Measured) response tone  

**NFR-03 — Usability**  
- Clean, responsive web interface  
- Mobile-friendly layout  
- Intuitive research workflow  

**NFR-04 — Performance**  
- Streaming API responses where feasible  
- Efficient document processing  

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND LAYER                       │
│  index.html + styles.css + app.js                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Input Panel  │  │ Agent Chat   │  │  Dashboard   │  │
│  │ Topic/Domain │  │ Query/Answer │  │  Charts/Viz  │  │
│  │ Keywords/PDF │  │ Context-aware│  │  KnowledgeGr.│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/REST (JSON)
┌────────────────────────▼────────────────────────────────┐
│                     BACKEND LAYER                        │
│  app.py (Flask)                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              research_agent.py                    │   │
│  │  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  Prompt Eng. │  │  Guardrails  │              │   │
│  │  │  System Msg  │  │  Injection   │              │   │
│  │  │  Context Mgr │  │  Detection   │              │   │
│  │  └──────────────┘  └──────────────┘              │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │           document_processor.py                   │   │
│  │  PDF Extraction │ Text Processing │ Summarization │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ Groq SDK
┌────────────────────────▼────────────────────────────────┐
│                   GROQ API LAYER                         │
│  Model: qwen/qwen3.8-27b                                │
│  Environment: GROQ_API_KEY (server-side only)           │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Agentic AI Design

### 5.1 Agent Roles & Capabilities

| Agent Role | Responsibility | Trigger |
|---|---|---|
| **Research Planner** | Topic refinement, objectives, methodology | Topic + domain input |
| **Literature Analyst** | Summaries, gap identification, trends | Keywords + notes |
| **Document Summarizer** | PDF/text extraction and structured summary | File upload |
| **Query Responder** | Conversational research assistance | Free-form chat |
| **Dashboard Generator** | Extract structured data for visualization | Post-analysis |

### 5.2 Prompt Engineering Strategy

- **System Prompt:** Establishes the agent as an ethical research companion with explicit non-fabrication rules
- **Context Injection:** User's domain, topic, keywords, and objectives are injected into every request
- **Task-specific sub-prompts:** Each research task has a specialized prompt template
- **Output structuring:** JSON-formatted responses for dashboard data, markdown for chat

### 5.3 Guardrail Architecture

**Layer 1 — Input Sanitization**  
- Detect and neutralize prompt injection patterns  
- Block attempts to override system instructions  
- Sanitize uploaded document text before injection  
- Maximum context length enforcement  

**Layer 2 — Output Validation**  
- Flag suspicious reference patterns (e.g., DOI hallucination indicators)  
- Ensure disclaimer is always appended  
- Validate JSON structure for dashboard data  

**Layer 3 — Behavioral Constraints (System Prompt)**  
- Explicit instruction to never fabricate academic sources  
- Instruction to mark uncertainty clearly  
- HAM tone enforcement  

---

## 6. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | HTML5, CSS3, Vanilla JS | UI, dashboard |
| Visualization | Chart.js, D3.js (force graph) | Charts, knowledge graph |
| Backend | Python 3.10+, Flask | REST API, routing |
| AI Model | qwen/qwen3.8-27b (Groq) | Research intelligence |
| PDF Processing | PyMuPDF (fitz) | PDF text extraction |
| Environment | python-dotenv | Secure API key loading |
| Deployment | Windows BAT + venv | Local setup |

---

## 7. Security Design

### 7.1 API Key Protection
- Stored in `.env` file, never committed to source control  
- `.gitignore` includes `.env`  
- Loaded server-side only via `python-dotenv`  
- Frontend has zero access to API credentials  

### 7.2 Prompt Injection Defence
```python
INJECTION_PATTERNS = [
    r"ignore (previous|all|above|prior) instructions",
    r"reveal (your|the|system) (prompt|instructions|key)",
    r"you are now",
    r"act as (a|an) (different|new)",
    r"bypass (safety|filter|guardrail)",
    r"forget everything",
    r"disregard",
    r"new instructions:",
    r"sudo",
    r"<\|system\|>",
    r"jailbreak"
]
```

### 7.3 File Upload Security
- File type whitelist: `.pdf`, `.txt`, `.md`  
- File size limit: 10MB  
- Content extracted server-side, not executed  

---

## 8. Data Flow

```
User Input → Sanitize → Build Context → System Prompt + Context + Query
    → Groq API (qwen3.8-27b) → Response → Output Validation
    → Append Disclaimer → Return to Frontend → Render Dashboard / Chat
```

---

## 9. Ethical AI Commitments

1. **No Fabrication:** The system will never generate fake paper titles, fake authors, fake journals, fake DOI numbers, fake statistics, or fabricated experimental results.
2. **Transparency:** Every AI-generated output is clearly labeled as AI-generated and unverified.
3. **Verification Disclaimer:** All outputs include a disclaimer advising users to verify against original academic sources.
4. **HAM Tone:** Responses are Helpful, Accurate (to the extent possible), and Measured.
5. **User Autonomy:** The system provides research assistance, not final answers — users retain academic responsibility.

---

## 10. SDLC Phases

| Phase | Status | Deliverable |
|---|---|---|
| 1. Requirements | ✅ Complete | This document (Sections 1–4) |
| 2. Architecture Design | ✅ Complete | System architecture diagram |
| 3. Security Design | ✅ Complete | Guardrail specification |
| 4. Implementation | ✅ Complete | All source files |
| 5. Integration | ✅ Complete | Frontend ↔ Backend ↔ Groq |
| 6. Testing | Manual | Use setup_and_run.bat to test |
| 7. Deployment | ✅ Complete | setup_and_run.bat |
| 8. Documentation | ✅ Complete | README.md + this plan |

---

## 11. File Structure

```
research_agent/
├── app.py                    # Flask backend + REST endpoints
├── research_agent.py         # Agent logic, prompts, guardrails
├── document_processor.py     # PDF/text document processing
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variable template
├── .gitignore                # Excludes .env and uploads
├── setup_and_run.bat         # Windows one-click launcher
├── research_agent_plan.md    # This document (SDLC plan)
├── README.md                 # User-facing setup guide
├── templates/
│   └── index.html            # Main web application
├── static/
│   ├── css/
│   │   └── styles.css        # Application styles
│   └── js/
│       └── app.js            # Frontend logic + visualizations
└── uploads/                  # Temporary document uploads (gitignored)
```

---

## 12. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Serve main application |
| POST | `/api/analyze` | Full research analysis |
| POST | `/api/chat` | Agent chat query |
| POST | `/api/upload` | Document upload + extraction |
| POST | `/api/dashboard` | Generate dashboard data |
| GET | `/api/health` | Health check |

---

## 13. Disclaimer (Embedded in All Outputs)

> ⚠️ **AI Research Disclaimer:** The insights, summaries, references, and analysis generated by this application are AI-generated and have not been independently verified. They should not be used in academic publications, assignments, experiments, or important research decisions without first being verified against original academic sources. References listed may be AI-suggested topic areas and are NOT verified citations. Always consult peer-reviewed databases such as Google Scholar, PubMed, IEEE Xplore, ACM Digital Library, or Scopus for verified academic sources.
