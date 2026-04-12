import json
from pathlib import Path

def generate_specs_json():
    # Hardcode matrices based on general Vulcan OmniPro 220 specifications
    specs = {
        "duty_cycle": {
            "MIG": {
                "120V": "40% @ 125A, 100% @ 90A",
                "240V": "30% @ 200A, 100% @ 110A"
            },
            "TIG": {
                "120V": "40% @ 125A, 100% @ 90A",
                "240V": "30% @ 175A, 100% @ 105A"
            },
            "Stick": {
                "120V": "40% @ 90A, 100% @ 60A",
                "240V": "30% @ 175A, 100% @ 105A"
            }
        },
        "polarity": {
            "MIG_Solid_Wire": "DCEP",
            "Flux_Cored": "DCEN",
            "TIG": "DCEN",
            "Stick": "DCEP"
        }
    }
    
    script_dir = Path(__file__).resolve().parent
    api_dir = script_dir.parent
    data_dir = api_dir / "data"
    
    # Create the data directory if it does not yet exist
    data_dir.mkdir(exist_ok=True)
    
    output_path = data_dir / "machine_specs.json"
    
    # Save the JSON file
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(specs, f, indent=4)
        
    print(f"[*] Successfully saved machine specifications to: {output_path}")


def fetch_duty_cycle(process: str, voltage: str):
    """
    Loads the saved JSON file and fetches the specific duty cycle.
    """
    script_dir = Path(__file__).resolve().parent
    api_dir = script_dir.parent
    data_dir = api_dir / "data"
    input_path = data_dir / "machine_specs.json"
    
    if not input_path.exists():
        print("[-] Data file not found. Ensure you have generated the JSON first.")
        return None
        
    with open(input_path, "r", encoding="utf-8") as f:
        specs = json.load(f)
        
    try:
        duty_cycle = specs["duty_cycle"][process][voltage]
        print(f"[+] Duty Cycle for {process} at {voltage}: {duty_cycle}")
        return duty_cycle
    except KeyError:
        print(f"[-] Data not found for process '{process}' at '{voltage}'.")
        return None

if __name__ == "__main__":
    # 1. Generate the JSON file
    generate_specs_json()
    print("-" * 40)
    
    # 2. Extract and prove it can fetch properly
    fetch_duty_cycle("MIG", "240V")
    fetch_duty_cycle("TIG", "120V")
    fetch_duty_cycle("Stick", "240V")
