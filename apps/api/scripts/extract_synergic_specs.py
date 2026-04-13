import os
import json
import base64
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from anthropic import AsyncAnthropic
import fitz  # PyMuPDF

# Setup paths
SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent
FILES_DIR = ROOT_DIR / "data" / "files"
DATA_DIR = ROOT_DIR / "data"

# Load environment variables
load_dotenv(ROOT_DIR / ".env")

client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def convert_pdf_page_to_base64(pdf_path: Path, page_num: int) -> str:
    print(f"Converting {pdf_path.name} page {page_num + 1} to image...")
    doc = fitz.open(str(pdf_path))
    page = doc.load_page(page_num)
    # Get pixmap at 2.0 zoom (approx 144 DPI) for good readability
    zoom = 2.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    # Convert to jpeg bytes and then base64
    img_data = pix.tobytes("jpeg")
    return base64.b64encode(img_data).decode("utf-8")

async def extract_specs():
    quick_start_path = FILES_DIR / "quick-start-guide.pdf"
    selection_chart_path = FILES_DIR / "selection-chart.pdf"
    
    if not quick_start_path.exists() or not selection_chart_path.exists():
        print("Error: PDF files not found in the files/ directory.")
        return

    # Convert pages (0-indexed)
    qs_page1_b64 = convert_pdf_page_to_base64(quick_start_path, 0)
    qs_page2_b64 = convert_pdf_page_to_base64(quick_start_path, 1)
    sc_page1_b64 = convert_pdf_page_to_base64(selection_chart_path, 0)

    system_prompt = """You are an expert technical data extraction assistant.
Your task is to analyze the provided manual pages and extract specific machine setup rules and process selection logic.
Output ONLY a JSON object matching this exact structure, with no markdown formatting, no comments, and no text outside the JSON:
{
  "processes": {
    "MIG": { "ground_polarity": "negative", "torch_polarity": "positive", "gas": "Required (e.g., C25)", "drive_roll": "V-groove" },
    "Flux_Cored": { "ground_polarity": "...", "torch_polarity": "...", "gas": "...", "drive_roll": "..." },
    "TIG": { "ground_polarity": "...", "torch_polarity": "...", "gas": "...", "drive_roll": "..." },
    "Stick": { "ground_polarity": "...", "torch_polarity": "...", "gas": "...", "drive_roll": "..." }
  },
  "selection_matrix": [
    { "material": "Steel", "thickness_range": "24 Gauge to 3/16", "recommended_process": "TIG", "characteristics": "Extremely clean" }
    // ... extract the rest from selection-chart.pdf
  ]
}"""

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Here are the first two pages of the Quick Start Guide. Please extract the process setup rules for MIG, Flux Cored, TIG, and Stick."
                },
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": qs_page1_b64
                    }
                },
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": qs_page2_b64
                    }
                },
                {
                    "type": "text",
                    "text": "Here is the Selection Chart. Please extract the selection matrix rules for different materials and thicknesses."
                },
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": sc_page1_b64
                    }
                }
            ]
        }
    ]

    print("Sending images to Anthropic API (claude-sonnet-4-6)...")
    
    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
            temperature=0
        )
        
        # Get raw text response
        raw_output = response.content[0].text.strip()
        
        # Strip potential markdown formatting if model didn't obey
        if raw_output.startswith("```json"):
            raw_output = raw_output[7:]
        elif raw_output.startswith("```"):
            raw_output = raw_output[3:]
            
        if raw_output.endswith("```"):
            raw_output = raw_output[:-3]
            
        raw_output = raw_output.strip()

        # Parse JSON to verify it's valid
        specs_data = json.loads(raw_output)
        print("Successfully validated JSON output from model.")

        # Save to file
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        output_file = DATA_DIR / "machine_specs.json"
        
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(specs_data, f, indent=2)
            
        print(f"Data successfully saved to {output_file}")
        
    except json.JSONDecodeError as e:
        print(f"Error: Failed to parse JSON from model output. Raw output was:")
        print(raw_output)
        print(f"JSON Error: {e}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(extract_specs())
