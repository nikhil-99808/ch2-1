# ExamScheduler AI

An upgraded Operating Systems project based on the original **ExamScheduler — Round Robin CPU Scheduling** presentation and speaker guide. It combines an interactive CPU scheduler with a Groq-powered AI tutor and a local Retrieval-Augmented Generation (RAG) knowledge base.

## Features

### 1. Round Robin CPU simulator
- Add and remove processes with ID, activity, arrival time, and burst time.
- Configure the time quantum.
- Simulate a FIFO ready queue with process arrivals during execution.
- Correctly show CPU idle intervals when no process has arrived yet.
- Render a Gantt chart, execution trace, and per-process CT, TAT, WT, and RT.
- Calculate average waiting, turnaround, and response times plus CPU utilization.
- Includes the original five-process example from the presentation.

### 2. Generative AI tutor (Groq)
- Ask operating-systems questions in natural language.
- Uses Groq's OpenAI-compatible Chat Completions endpoint.
- Model is configurable with `GROQ_MODEL`; the included default is `openai/gpt-oss-120b`.
- Generates multiple-choice viva practice questions.
- The API key is read only by the backend from `.env`; it is not placed in frontend JavaScript.

### 3. RAG knowledge base
- Upload PDF, DOCX, TXT, Markdown, and CSV files (10 MB default limit).
- Extracts text, creates overlapping chunks, and stores them in SQLite.
- Retrieves relevant chunks using local BM25 ranking.
- Adds retrieved passages to the Groq prompt and returns source labels to the UI.
- Starts with an indexed project brief based on the ExamScheduler project material.
- Delete individual source documents from the index.

### 4. Technology stack

| Layer | Technology |
|---|---|
| User interface | HTML5, CSS3, vanilla JavaScript |
| API server | Python, FastAPI, Uvicorn |
| Generative AI | Groq Chat Completions API |
| Retrieval | BM25 sparse retrieval, local implementation |
| Document parsing | pypdf, python-docx |
| Data persistence | SQLite |
| Validation and tests | Pydantic, pytest |
| Packaging | Docker / Docker Compose |

## Run on Windows

1. Extract the ZIP into a folder.
2. Install Python 3.10 or newer.
3. Double-click `start_windows.bat` once. It creates a virtual environment, installs the dependencies, and creates `.env` from `.env.example`.
4. Open the `.env` file and replace `your_groq_api_key_here` with your Groq API key.
5. Save `.env`, stop the server if it is running, and run `start_windows.bat` again.
6. Open **http://127.0.0.1:8000** in your browser.

The first run may take a few minutes while Python dependencies install. Keep the terminal window open while using the app.

## Run on macOS / Linux

```bash
chmod +x start_mac_linux.sh
./start_mac_linux.sh
```

Copy your Groq API key into `.env`, then restart the script. Visit `http://127.0.0.1:8000`.

## Run manually

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env  # On Windows, copy .env.example .env
# Edit .env and set GROQ_API_KEY
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

## Configure Groq

In `.env`:

```env
GROQ_API_KEY=your_actual_key
GROQ_MODEL=openai/gpt-oss-120b
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions
```

You can change `GROQ_MODEL` to another model enabled for your Groq account. Do not commit or share your `.env` file. If the key is absent, the simulator and document indexing still work, but AI chat and quiz generation return a clear setup message.

## Run tests

From the project root, with the virtual environment active:

```bash
python -m pytest backend/tests -q
```

The reference-case test checks the same 10 Gantt segments and averages shown in the original project guide:

- Average waiting time: 10.8 ms
- Average turnaround time: 14.4 ms
- Average response time: 4.0 ms
- CPU utilization: 100% (context-switch overhead ignored)

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health and Groq configuration |
| GET | `/api/dashboard` | Dashboard counts and indexed docs |
| POST | `/api/schedule/run` | Run Round Robin scheduling |
| POST | `/api/knowledge/upload` | Upload and index a document |
| GET | `/api/knowledge` | List indexed documents |
| DELETE | `/api/knowledge/{doc_id}` | Remove a document |
| POST | `/api/ai/ask` | RAG-grounded AI tutor answer |
| POST | `/api/ai/quiz` | Generate viva practice questions |

FastAPI's interactive API docs are available at `http://127.0.0.1:8000/docs` while the server is running.

## Architecture

```text
Browser UI
   |  REST / JSON
   v
FastAPI backend
   |-- Round Robin scheduler --> Gantt / metrics / execution trace
   |-- Document parser --> chunks --> SQLite
   |                             |
   |                         BM25 retrieval
   |                             |
   +-- AI Tutor / Quiz <--- retrieved context
                  |
                  v
          Groq Chat Completions
```

## Notes and limitations

- BM25 is a local lexical retrieval method. It is a legitimate sparse RAG retriever, but it is not a neural embedding or vector database. This keeps setup light and avoids downloading a separate embedding model. It can be upgraded later to a vector store and embedding model if desired.
- Scanned PDFs that contain only images may not yield extractable text; run OCR separately before uploading those files.
- The project is designed as a local educational demo. Before public deployment, add authentication, per-user data separation, upload scanning, request quotas, HTTPS, and production logging.
- Uploaded text passages used for AI answers are sent to Groq. Do not upload confidential or sensitive documents unless you are comfortable with that data flow.

## Project structure

```text
ExamScheduler-AI/
├── backend/app/          # FastAPI, scheduler, Groq client, RAG implementation
├── backend/tests/        # Scheduler regression tests
├── frontend/             # Responsive browser interface
├── knowledge_base/       # Human-readable starter notes
├── data/                 # SQLite database is created here on first run
├── uploads/              # Reserved for local uploaded-file workflows
├── .env.example          # Safe template; add your own key in .env
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── start_windows.bat
└── start_mac_linux.sh
```

## Credits

Based on the ExamScheduler Operating Systems project materials supplied for this build. The original Round Robin process data and performance figures are included as the default reference case.
