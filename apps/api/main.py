import os
import json
import base64
from pathlib import Path
from typing import List, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from anthropic import AsyncAnthropic, APIError

import chromadb
from chromadb.utils import embedding_functions

# Global cache for specs data to avoid disk I/O on every tool call
SPECS_DATA = {}

def get_duty_cycle(process: str, voltage: str) -> str:
    try:
        return SPECS_DATA.get("duty_cycle", {})[process][voltage]
    except KeyError:
        return "Specification not found in manual"

def get_polarity_setup(process: str) -> str:
    try:
        return SPECS_DATA.get("polarity", {})[process]
    except KeyError:
        return "Specification not found in manual"

TOOLS_SCHEMA = [
    {
        "name": "get_duty_cycle",
        "description": "Retrieves the explicit duty cycle limits for a specific welding process and input voltage.",
        "input_schema": {
            "type": "object",
            "properties": {
                "process": {"type": "string", "enum": ["MIG", "TIG", "Stick"], "description": "The welding process."},
                "voltage": {"type": "string", "enum": ["120V", "240V"], "description": "The input voltage."}
            },
            "required": ["process", "voltage"]
        }
    },
    {
        "name": "get_polarity_setup",
        "description": "Retrieves the polarity setup configuration for a specific welding process.",
        "input_schema": {
            "type": "object",
            "properties": {
                "process": {"type": "string", "enum": ["MIG_Solid_Wire", "Flux_Cored", "TIG", "Stick"], "description": "The specific process or wire type."}
            },
            "required": ["process"]
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
    }
]

# Load environment variables from the root .env file
dotenv_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=dotenv_path)

app = FastAPI(title="Claude Prox Challenge Backend")

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002"
    ],
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
        n_results=2 
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
NOTE: If your context indicates there is a visual diagram or chart on a page, you optionally have the ability to retrieve and 'look' at that visual page by calling the view_manual_page tool!"""
    system_prompt = f"You are the Prox Vulcan OmniPro 220 Support Agent. Answer the user's questions based ONLY on the following context. If you don't know the answer based on the context, say so.\n{clarification_rule}\n<context>\n{context_str}\n</context>\nCite the page number and document name when providing your answer."

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
                            page_path = Path(__file__).parent / "data" / "pages" / f"page_{page_number}.jpg"
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
                        if tc["name"] == "get_duty_cycle":
                            result_text = get_duty_cycle(input_data.get("process"), input_data.get("voltage"))
                        elif tc["name"] == "get_polarity_setup":
                            result_text = get_polarity_setup(input_data.get("process"))
                            
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