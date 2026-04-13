import os
import json
from pathlib import Path
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions

def extract_diagrams_docling():
    # Setup paths
    root_dir = Path(__file__).parent.parent
    pdf_path = root_dir / "data" / "files" / "owner-manual.pdf"
    static_dir = root_dir / "static" / "diagrams"
    
    # Create directories if they don't exist
    os.makedirs(static_dir, exist_ok=True)

    # 1. Configure Docling Pipeline
    # We explicitly tell Docling to render and extract high-res images of the detected figures
    pipeline_options = PdfPipelineOptions()
    pipeline_options.generate_picture_images = True
    
    # Optional: If you also want to extract tables as images (very useful for specs in manuals!)
    # pipeline_options.generate_table_images = True

    doc_converter = DocumentConverter(
        allowed_formats=[InputFormat.PDF],
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )

    print(f"📖 Analyzing PDF with Docling: {pdf_path}")
    print("⏳ This may take a moment as the layout models process the pages...")
    
    # 2. Run the Layout Extraction
    conv_result = doc_converter.convert(pdf_path)
    doc = conv_result.document

    metadata = {}
    total_extracted = 0

    print(f"🔍 Layout parsed! Extracting isolated diagrams...")

    # 3. Iterate through all detected pictures/figures
    for i, pic in enumerate(doc.pictures):
        # Ensure Docling successfully generated an image for this figure
        if not pic.image or not pic.image.pil_image:
            continue
            
        pil_img = pic.image.pil_image
        width, height = pil_img.size
        
        # Filter out tiny logos, page decorative borders, or icons
        if width < 150 or height < 150:
            continue

        # Extract the page number using Docling's provenance tracker
        page_no = pic.prov[0].page_no if pic.prov else "unknown"
        
        # 4. Grab associated text/captions
        # Docling automatically associates nearby labels/captions with the picture object!
        caption_text = ""
        if hasattr(pic, 'captions') and pic.captions:
            cap_texts = []
            for cap in pic.captions:
                # If it's a direct text object
                if hasattr(cap, 'text'):
                    cap_texts.append(cap.text)
                # If it's a RefItem pointer (Docling V2 data model)
                elif hasattr(cap, 'resolve'):
                    try:
                        resolved_cap = cap.resolve(doc)
                        if resolved_cap and hasattr(resolved_cap, 'text'):
                            cap_texts.append(resolved_cap.text)
                    except Exception:
                        pass # Failsafe in case of a broken reference
            
            caption_text = " | ".join(cap_texts)
        
        # Fallback description if no explicit caption is found
        description = caption_text if caption_text else f"Diagram/Figure extracted from page {page_no}."

        # Save the image locally
        filename = f"diagram_{page_no}_{i+1}_docling.png"
        filepath = static_dir / filename
        pil_img.save(filepath)

        # Save metadata
        metadata[filename] = {
            "page": page_no,
            "dimension": f"{width}x{height}",
            "description": description
        }
        total_extracted += 1
        
        # Print a short preview so you can see it working
        preview = description[:60] + "..." if len(description) > 60 else description
        print(f"   ✅ Saved {filename} (Caption: '{preview}')")

    # Save Metadata JSON
    metadata_path = static_dir / "diagram_metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4)
        
    print(f"\n🎉 Extraction complete! Successfully isolated {total_extracted} diagrams.")
    print(f"💾 Metadata saved to {metadata_path}")

if __name__ == "__main__":
    extract_diagrams_docling()