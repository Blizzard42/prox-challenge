import os
import json
import base64
from pathlib import Path
from typing import List, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from anthropic import AsyncAnthropic, APIError

import chromadb
from chromadb.utils import embedding_functions

# Global cache for specs data to avoid disk I/O on every tool call
SPECS_DATA = {}

def get_cable_configuration(process: str) -> str:
    try:
        process_data = SPECS_DATA.get("processes", {}).get(process)
        if not process_data:
            raise KeyError
        return json.dumps(process_data)
    except KeyError:
        return "DATA_NOT_IN_STATIC_CACHE. INSTRUCTION: You must now use the `view_manual_page` tool to inspect the Quick Start Guide visually, or rely on your standard RAG context."

def get_process_recommendation(material: str, thickness: str, environment: str) -> str:
    try:
        matrix = SPECS_DATA.get("selection_matrix", [])
        if not matrix:
            raise KeyError
        
        results = []
        for row in matrix:
            row_material = row.get("material", "").lower()
            if material.lower() in row_material or not material:
                results.append(row)
        
        if not results:
            raise KeyError
            
        return json.dumps(results)
    except KeyError:
        return "DATA_NOT_IN_STATIC_CACHE. INSTRUCTION: You must now use the `view_manual_page` tool to inspect the Quick Start Guide visually, or rely on your standard RAG context."

TOOLS_SCHEMA = [
    {
        "name": "get_cable_configuration",
        "description": "Retrieves the synergic machine cable configuration (polarity, gas, drive rolls) for a specific welding process. Use this tool whenever a user asks about how to set up the machine.",
        "input_schema": {
            "type": "object",
            "properties": {
                "process": {"type": "string", "enum": ["MIG", "Flux_Cored", "TIG", "Stick"], "description": "The specific welding process."}
            },
            "required": ["process"]
        }
    },
    {
        "name": "get_process_recommendation",
        "description": "Retrieves a recommended welding process based on material, thickness, and environment. Use this tool whenever a user asks what process they should use for their project.",
        "input_schema": {
            "type": "object",
            "properties": {
                "material": {"type": "string", "description": "The material being welded (e.g., Steel, Aluminum)."},
                "thickness": {"type": "string", "description": "The material's thickness."},
                "environment": {"type": "string", "description": "The environment (e.g., indoor, outdoor, windy)."}
            },
            "required": ["material", "thickness", "environment"]
        }
    },
    {
        "name": "view_manual_page",
        "description": "Retrieves An image of a specific manual page. Use this if the context indicates a diagram, chart, or visual instruction exists on a specific page that you need to look at.",
        "input_schema": {
            "type": "object",
            "properties": {
                "page_number": {"type": "integer", "description": "The page number of the manual to extract visually (e.g. 1, 2, 10)."}
            },
            "required": ["page_number"]
        }
    },
    {
        "name": "request_diagrams",
        "description": "Retrieves internal image URLs and descriptions of extracted diagrams available on a specific manual page. Once you get these URLs, you can render them to the user using the DiagramViewer component block.",
        "input_schema": {
            "type": "object",
            "properties": {
                "page_number": {"type": "integer", "description": "The page number to search for diagrams."}
            },
            "required": ["page_number"]
        }
    }
]

# Load environment variables from the root .env file
dotenv_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=dotenv_path)

app = FastAPI(title="Claude Prox Challenge Backend")

# Create the static directory (and parents) if it doesn't exist to prevent crash
static_dir = Path(__file__).parent / "static"
os.makedirs(static_dir, exist_ok=True)

# Mount the static directory
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")

chroma_client = None
collection = None

@app.on_event("startup")
def startup_event():
    global chroma_client, collection, SPECS_DATA
    
    print("\n🚀 Starting Backend Server...")
    
    # Load JSON specs into memory
    specs_path = Path(__file__).parent / "data" / "machine_specs.json"
    if specs_path.exists():
        with open(specs_path, "r", encoding="utf-8") as f:
            SPECS_DATA = json.load(f)
        print("✅ Structured specs loaded into memory.")
    else:
        print("⚠️ Warning: machine_specs.json not found in data directory.")

    # Initialize ChromaDB
    chroma_data_dir = Path(__file__).parent / "chroma_data"
    chroma_client = chromadb.PersistentClient(path=str(chroma_data_dir))
    emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
    collection = chroma_client.get_or_create_collection(name="vulcan_manual", embedding_function=emb_fn)
    print("✅ ChromaDB initialized and connected.")
    print("--------------------------------------\n")

# Setup CORS
FRONTEND_URLS = os.getenv("FRONTEND_URLS", "http://localhost:3000,http://localhost:3001,http://localhost:3002,https://prox-challenge-web.vercel.app").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

class ChatRequest(BaseModel):
    messages: List[Dict[str, Any]]

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # Extract query
    latest_message = request.messages[-1]
    query_text = latest_message.get("content", "")
    if isinstance(query_text, list):
        query_texts = [block["text"] for block in query_text if block.get("type") == "text"]
        query_text = " ".join(query_texts)

    print(f"\n[USER] 💬 {query_text}")

    # Query Chroma
    print(f"[RAG]  🔍 Searching ChromaDB...")
    results = collection.query(
        query_texts=[query_text],
        n_results=4
    )
    
    context_chunks = []
    if results and results.get("documents") and results["documents"][0]:
        for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
            source = meta.get("source", "Unknown")
            page = meta.get("page", "Unknown")
            context_chunks.append(f"[Source: {source}, Page: {page}]\n{doc}")
            
    context_str = "\n\n".join(context_chunks)
    print(f"[RAG]  📄 Retrieved {len(context_chunks)} chunks.")
    
    clarification_rule = """GUARDRAIL: If the user asks for wire feed speed, voltage, or machine setup parameters, you MUST verify you know ALL of the following before answering:
    1. The welding process (MIG, Flux-Cored, TIG, or Stick).
    2. The material type (Mild Steel, Stainless, Aluminum, etc.).
    3. The material thickness.
    4. The wire/electrode diameter.
If ANY of these four variables are missing, do not call a tool and do not guess. Politely ask the user to provide the missing specific details.
"""

    tool_rules = """
CRITICAL TOOL USE RULES (FAILURE TO FOLLOW THESE WILL BREAK THE SYSTEM):
1. SILENT EXECUTION: Do NOT narrate your tool usage. Never say "Let me check...", "I'm looking at...", or "I found...". Output the tool call immediately. Only speak to the user ONCE you have the final answer.
2. NO BLIND SEARCHING: Do NOT guess page numbers. ONLY use `view_manual_page` if your text context EXPLICITLY mentions a specific page number containing a visual chart or diagram to save on api cost.
"""
    interactive_ui_protocol = """INTERACTIVE UI RENDERING PROTOCOL
If you are recommending a welding process OR explaining a physical cable setup OR troubleshooting mechanical issues, you MUST output a strict JSON block inline, immediately following the sentence where you introduce it, wrapped in ```json ... ``` tags. 
For Process Recommendations, use this schema:
```json
{ "artifact_type": "process_selector", "inputs": {"material": "...", "thickness": "...", "environment": "..."} }```
For Cable Setup, use this schema:
```json
{ "artifact_type": "physical_setup", "process": "...", "ground_polarity": "...", "torch_polarity": "...", "gas": "...", "drive_roll": "..." }```
For Troubleshooting Mechanical Issues (e.g., porosity, wire feeding problems), use this schema:
```json
{ "artifact_type": "troubleshooting", "issue": "...", "steps": ["Check X", "Adjust Y", "Verify Z"] }```
For Displaying specific relevant diagrams to the user, output this schema at the end of the message:
```json
{"component": "DiagramViewer", "props": {"imageUrl": "...", "caption": "..."}}```
Do not include any text after the JSON block."""

    system_prompt = f"You are the Prox Vulcan OmniPro 220 Support Agent. Answer the user's questions based ONLY on the following context. If you don't know the answer based on the context, say so.\n{clarification_rule}\n\n{tool_rules}\n\n{interactive_ui_protocol}\n\n<context>\n{context_str}\n</context>\nCite the page number and document name when providing your answer. When citing a page number, you MUST format it exactly like this: [Page X] (where X is the number). Do not wrap the citation in asterisks, parentheses, or italics."

    async def generate_sse():
        current_messages = list(request.messages)
        
        while True:
            try:
                stream = await client.messages.create(
                    max_tokens=2048,
                    messages=current_messages,
                    model="claude-sonnet-4-6",
                    system=system_prompt,
                    tools=TOOLS_SCHEMA,
                    stream=True,
                )
                
                tool_calls = []
                current_tool = None
                current_text = ""
                
                async for event in stream:
                    yield f"data: {event.model_dump_json()}\n\n"
                    
                    if event.type == "content_block_start" and event.content_block.type == "tool_use":
                        current_tool = {
                            "id": event.content_block.id,
                            "name": event.content_block.name,
                            "input_json": ""
                        }
                    elif event.type == "content_block_delta":
                        if event.delta.type == "input_json_delta" and current_tool:
                            current_tool["input_json"] += event.delta.partial_json
                        elif event.delta.type == "text_delta":
                            current_text += event.delta.text 
                    elif event.type == "content_block_stop":
                        if current_tool:
                            tool_calls.append(current_tool)
                            current_tool = None
                            
                if not tool_calls:
                    break
                    
                # Reconstruct tool_use messages for Claude's history tracking requirements
                assistant_message = {"role": "assistant", "content": []}
                
                if current_text:
                    assistant_message["content"].append({
                        "type": "text",
                        "text": current_text
                    })
                    
                for tc in tool_calls:
                    assistant_message["content"].append({
                        "type": "tool_use",
                        "id": tc["id"],
                        "name": tc["name"],
                        "input": json.loads(tc["input_json"])
                    })
                current_messages.append(assistant_message)
                
                # Run local tools and prepare result array
                user_message = {"role": "user", "content": []}
                for tc in tool_calls:
                    try:
                        input_data = json.loads(tc["input_json"])
                        print(f"\n[TOOL] 🛠️  Executing '{tc['name']}' with args: {input_data}")
                        
                        # Handle Vision retrieval manually
                        if tc["name"] == "view_manual_page":
                            page_number = input_data.get("page_number")
                            page_path = Path(__file__).parent / "static" / "pages" / f"page_{page_number}.jpg"
                            if page_path.exists():
                                with open(page_path, "rb") as img_file:
                                    b64_data = base64.b64encode(img_file.read()).decode("utf-8")
                                user_message["content"].append({
                                    "type": "tool_result",
                                    "tool_use_id": tc["id"],
                                    "content": [
                                        {
                                            "type": "image",
                                            "source": {
                                                "type": "base64",
                                                "media_type": "image/jpeg",
                                                "data": b64_data
                                            }
                                        }
                                    ]
                                })
                                print(f"[TOOL] ✅  Success: Attached image data for page {page_number}")
                            else:
                                user_message["content"].append({
                                    "type": "tool_result",
                                    "tool_use_id": tc["id"],
                                    "content": f"Error: Page {page_number} image not found locally."
                                })
                                print(f"[TOOL] ❌  Error: Page {page_number} not found.")
                            continue
                            
                        # Handle text specs
                        result_text = "Specification not found in manual"
                        if tc["name"] == "get_cable_configuration":
                            result_text = get_cable_configuration(input_data.get("process"))
                        elif tc["name"] == "get_process_recommendation":
                            result_text = get_process_recommendation(
                                input_data.get("material", ""),
                                input_data.get("thickness", ""),
                                input_data.get("environment", "")
                            )
                        elif tc["name"] == "request_diagrams":
                            page_number = input_data.get("page_number")
                            meta_path = Path(__file__).parent / "static" / "diagrams" / "diagram_metadata.json"
                            
                            matching = None
                            if meta_path.exists():
                                with open(meta_path, "r", encoding="utf-8") as f:
                                    meta = json.load(f)
                                matching = {
                                    k: {"imageUrl": f"/static/diagrams/{k}", "description": v["description"]}
                                    for k, v in meta.items() if v["page"] == page_number
                                }
                                
                            if matching:
                                result_text = json.dumps(matching)
                            else:
                                page_path = Path(__file__).parent / "static" / "pages" / f"page_{page_number}.jpg"
                                if page_path.exists():
                                    fallback = {
                                        f"page_{page_number}_full.jpg": {
                                            "imageUrl": f"/static/pages/page_{page_number}.jpg",
                                            "description": f"Full page {page_number} visual (Fallback)"
                                        }
                                    }
                                    result_text = json.dumps(fallback)
                                else:
                                    result_text = "No extracted diagrams found on this page, and no fallback page image available."
                            
                        user_message["content"].append({
                            "type": "tool_result",
                            "tool_use_id": tc["id"],
                            "content": str(result_text)
                        })
                        print(f"[TOOL] ✅  Success: {str(result_text)[:100]}...")
                        
                    except Exception as e:
                        user_message["content"].append({
                            "type": "tool_result",
                            "tool_use_id": tc["id"],
                            "content": f"Tool execution failed: {e}"
                        })
                        print(f"[TOOL] ❌  Exception occurred: {e}")
                        
                current_messages.append(user_message)
                print(f"[AGENT] 🔄 Sending tool results back to Claude for final synthesis...\n")
                
                # INJECT SYNTHETIC SPACING EVENT HERE
                # This guarantees a double newline in the frontend UI between pre-tool text and post-tool text
                if current_text.strip():
                    synthetic_space_event = {
                        "type": "content_block_delta",
                        "index": 0,
                        "delta": {
                            "type": "text_delta",
                            "text": "\n\n"
                        }
                    }
                    yield f"data: {json.dumps(synthetic_space_event)}\n\n"
                
            except APIError as e:
                print(f"\n[ERROR] 🛑 Anthropic API Error: {str(e)}")
                error_payload = json.dumps({"error": str(e)})
                yield f"data: {error_payload}\n\n"
                break
            except Exception as e:
                print(f"\n[ERROR] 🛑 Internal Server Error: {str(e)}")
                error_payload = json.dumps({"error": "Internal Server Error"})
                yield f"data: {error_payload}\n\n"
                break

    return StreamingResponse(generate_sse(), media_type="text/event-stream")