import os
from pathlib import Path
import fitz  # PyMuPDF
import chromadb
from chromadb.utils import embedding_functions
from langchain_text_splitters import RecursiveCharacterTextSplitter

def main():
    script_dir = Path(__file__).resolve().parent
    root_dir = script_dir.parent
    
    files_dir = root_dir / "data" / "files"
    chroma_data_dir = root_dir / "chroma_data"
    
    print(f"[*] Reading PDFs from: {files_dir}")
    print(f"[*] Chroma storage at: {chroma_data_dir}")
    print()
    
    # Target files
    target_pdfs = ["owner-manual.pdf", "selection-chart.pdf", "quick-start-guide.pdf"]
    
    # Initialize Text Splitter
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        is_separator_regex=False,
    )
    
    # Initialize Chroma DB
    chroma_client = chromadb.PersistentClient(path=str(chroma_data_dir))
    
    # We use MiniLM as it is fast and local
    emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
    
    # Collection
    collection = chroma_client.get_or_create_collection(
        name="vulcan_manual",
        embedding_function=emb_fn
    )
    
    total_chunks = 0
    
    for pdf_name in target_pdfs:
        pdf_path = files_dir / pdf_name
        if not pdf_path.exists():
            print(f"[!] Warning: File {pdf_name} not found at {pdf_path}")
            continue
            
        print(f"[*] Processing {pdf_name}...")
        
        doc = fitz.open(pdf_path)
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text()
            
            if not text.strip():
                continue
                
            # Split text
            chunks = text_splitter.split_text(text)
            
            if not chunks:
                continue
            
            # Prepare data to insert
            documents = chunks
            metadatas = [{"source": pdf_name, "page": page_num + 1} for _ in chunks]
            ids = [f"{pdf_name}_p{page_num+1}_c{i}" for i in range(len(chunks))]
            
            # Insert into Chroma DB
            collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            
            total_chunks += len(chunks)
            if (page_num + 1) % 10 == 0:
                print(f"    - Processed {page_num + 1}/{len(doc)} pages")
                
        print(f"[+] Finished {pdf_name}. Total pages: {len(doc)}")
        doc.close()
        
    print(f"\n[SUCCESS] Ingestion complete. Stored a total of {total_chunks} chunks.")

if __name__ == "__main__":
    main()
