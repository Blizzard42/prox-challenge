import os
import json
import fitz  # PyMuPDF
from pathlib import Path

def extract_diagrams():
    # Setup paths
    root_dir = Path(__file__).parent.parent.parent.parent
    pdf_path = root_dir / "files" / "owner-manual.pdf"
    static_dir = Path(__file__).parent.parent / "static" / "diagrams"
    
    # Create directories if they don't exist
    os.makedirs(static_dir, exist_ok=True)
    
    print(f"📖 Opening PDF: {pdf_path}")
    doc = fitz.open(str(pdf_path))
    
    metadata = {}
    total_extracted = 0
    
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        image_list = page.get_images(full=True)
        
        # Note: PyMuPDF page numbers are 0-indexed, but usually manual pages are 1-indexed for the user.
        # We will use 1-indexed to be consistent with ChatBot 'page_number'
        display_page = page_num + 1 
        
        if image_list:
            print(f"📄 Page {display_page}: Found {len(image_list)} images")
        
        img_index = 0
        for img_info in image_list:
            xref = img_info[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            ext = base_image["ext"]
            width = base_image["width"]
            height = base_image["height"]
            
            # Filter out tiny images like logos or UI elements (e.g., less than 200x200 or very thin lines)
            if width < 200 or height < 200:
                continue
                
            img_index += 1
            filename = f"diagram_{display_page}_{img_index}.{ext}"
            filepath = static_dir / filename
            
            with open(filepath, "wb") as f:
                f.write(image_bytes)
                
            # Add to metadata map
            metadata[filename] = {
                "page": display_page,
                "dimension": f"{width}x{height}",
                "description": f"Main visual diagram/schema extracted from page {display_page} of the manual."
            }
            total_extracted += 1

    metadata_path = static_dir / "diagram_metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4)
        
    print(f"✅ Extraction complete! Embedded {total_extracted} diagrams.")
    print(f"💾 Metadata saved to {metadata_path}")

if __name__ == "__main__":
    extract_diagrams()
