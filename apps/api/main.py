import os
import json
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

# Load environment variables from the root .env file
dotenv_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=dotenv_path)

app = FastAPI(title="Claude Prox Challenge Backend")

chroma_client = None
collection = None

@app.on_event("startup")
def startup_event():
    global chroma_client, collection
    chroma_data_dir = Path(__file__).parent / "chroma_data"
    chroma_client = chromadb.PersistentClient(path=str(chroma_data_dir))
    emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
    collection = chroma_client.get_or_create_collection(name="vulcan_manual", embedding_function=emb_fn)

# Setup CORS using an explicit array of standard local ports
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

# Initialize Anthropic client
# We expect ANTHROPIC_API_KEY to be loaded in the environment
client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

class ChatRequest(BaseModel):
    # Using generalized List[Dict[str, Any]] to easily accept text and multimodal image blocks
    messages: List[Dict[str, Any]]

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # Extract query
    latest_message = request.messages[-1]
    query_text = latest_message.get("content", "")
    if isinstance(query_text, list):
        query_texts = [block["text"] for block in query_text if block.get("type") == "text"]
        query_text = " ".join(query_texts)

    # Query Chroma
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
    print("----- CONTEXT -----")
    print(context_str)
    print("-------------------")
    system_prompt = f"You are the Prox Vulcan OmniPro 220 Support Agent. Answer the user's questions based ONLY on the following context. If you don't know the answer based on the context, say so.\n<context>\n{context_str}\n</context>\nCite the page number and document name when providing your answer."

    async def generate_sse():
        try:
            stream = await client.messages.create(
                max_tokens=2048,
                messages=request.messages,
                model="claude-sonnet-4-6",
                system=system_prompt,
                stream=True,
            )
            async for event in stream:
                yield f"data: {event.model_dump_json()}\n\n"
        except APIError as e:
            error_payload = json.dumps({"error": str(e)})
            yield f"data: {error_payload}\n\n"
        except Exception as e:
            error_payload = json.dumps({"error": "Internal Server Error"})
            yield f"data: {error_payload}\n\n"

    return StreamingResponse(generate_sse(), media_type="text/event-stream")
