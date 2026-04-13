import fitz  # PyMuPDF
from pathlib import Path

def slice_pdf_to_images():
    print("Starting PDF Slice Process...")
    api_dir = Path(__file__).resolve().parent.parent
    workspace_dir = api_dir.parent.parent
    
    pdf_path = workspace_dir / "files" / "owner-manual.pdf"
    if not pdf_path.exists():
        print(f"[-] Error: Could not find {pdf_path}")
        return
        
    output_dir = api_dir / "static" / "pages"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    doc = fitz.open(pdf_path)
    
    # Render with 2.0x scale matrix for high quality
    mat = fitz.Matrix(2.0, 2.0)
    
    print(f"[*] Extracting {len(doc)} pages...")
    for i in range(len(doc)):
        page = doc.load_page(i)
        pix = page.get_pixmap(matrix=mat)
        
        # We index using i+1 to naturally align page numbers
        out_file = output_dir / f"page_{i+1}.jpg"
        pix.save(str(out_file))
        
    print(f"[+] Successfully sliced {len(doc)} pages into JPEG at: {output_dir}")

if __name__ == "__main__":
    slice_pdf_to_images()
