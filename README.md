# Vulcan OmniPro 220 - Interactive Support Agent

[INSERT LOOM VIDEO DEMO LINK HERE]

## Project Overview
The Vulcan OmniPro 220 Support Agent is a next-generation multimodal conversational AI built to deliver unparalleled, hands-free hardware support directly in the garage. By combining robust RAG (Retrieval-Augmented Generation) capabilities with an Interactive Artifact Engine, complex mechanical configurations and troubleshooting steps are rendered dynamically as interactive React interfaces rather than dense text. 

Built exclusively for the Vulcan OmniPro 220 manual, it features voice dictation, full-page original manual surfing, diagram extraction, and automated diagnostics capabilities.

## Architecture
The repository uses a modern, high-performance monorepo architecture:
- **Frontend**: Next.js (React 18), Tailwind CSS, Lucide Icons. Designed mobile-first for harsh garage environments.
- **Backend Service**: FastAPI (Python 3.11+). Handles robust async streaming and orchestrates system prompts.
- **LLM Base**: Anthropic Claude 3.5 Sonnet (Claude 4.6 configuration template). Serves as the primary synthesis engine capable of reasoning multimodally.
- **Vector Database**: ChromaDB. Used for Offline RAG pipeline ingestion indexing the raw Vulcan manuals via sentence-transformers embeddings.

## The Artifact Engine
The core innovation in this project is the **Interactive Artifact Rendering Engine**.
Instead of returning giant blocks of text when a user asks how to set up their welder, Claude is instructed to append structured JSON payloads via a customized System Prompt protocol. 

The Next.js frontend intercepts the server-sent events stream, parses instances of ````json {"artifact_type": "physical_setup", ... } ```` or `{"component": "DiagramViewer", ...}`, removes them from the text payload, and natively mounts interactive, tailwind-styled React widgets directly into the chat feed.

This enables:
- Visual Machine process selectors.
- Physical polarity / connection readouts.
- Extracted reference diagrams natively loaded from the backend context.
- Guided troubleshooting decision trees.

## Structured Knowledge Extraction
To prevent hallucination in critical hardware configurations, the backend combines standard Semantic RAG alongside a static extraction pipeline:
1. **PyMuPDF Diagram Extraction**: A local Python script parses the embedded manual PDFs and geometrically isolates and extracts embedded visual diagrams.
2. **Deterministic Lookup Matrices**: Wire feed speeds, voltage polarity, and gas types for the synergic machine are hardcoded into `machine_specs.json` reducing inference latency and ensuring 100% accuracy on critical safety operations.
3. **Claude Tool Mapping**: Claude uses the Anthropic Tool Spec schema to programmatically ping these sub-datasets based on missing context.

## Local Setup Instructions

### Pre-requisites
- Node.js 18+
- Python 3.11+
- Anthropic API Key

### 1. Configure Environment
Create an `.env` file at the root of the project:
```bash
ANTHROPIC_API_KEY=your-api-key-here
FRONTEND_URLS=http://localhost:3000,http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 2. Backend Setup
Navigate to the `apps/api` folder:
```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/ingest_docs.py # Setup Chroma Database for RAG
python scripts/slice_pages.py # Slice pages into images for RAG
python scripts/extract_diagrams.py  # Extract the manual diagrams
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup
In a new terminal window, navigate to the root folder:
```bash
npm install
npm run dev --workspace=apps/web
```
Access the application at `http://localhost:3000`.

## Deployment Configuration

**Backend Deployment:**
The `apps/api` folder includes an optimized `Dockerfile`. Simply build and push to Google Cloud Run, AWS App Runner, or Render. Provide the `$PORT` ENV variable and your `${ANTHROPIC_API_KEY}`. Add your production frontend domain to `FRONTEND_URLS` inside the `.env`.

**Frontend Deployment:**
Deploy the Next.js app to Vercel or Netlify. Set `NEXT_PUBLIC_API_URL` to point to the deployed FastAPI endpoint. Ensure that the Next.js build output runs standalone or appropriately for your edge provider.
