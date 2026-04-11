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

# Load environment variables from the root .env file
dotenv_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=dotenv_path)

app = FastAPI(title="Claude Prox Challenge Backend")

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
    async def generate_sse():
        try:
            stream = await client.messages.create(
                max_tokens=2048,
                messages=request.messages,
                model="claude-sonnet-4-6",
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
