#!/usr/bin/env python3
"""
glTF to VRMA Converter
This tool converts Mixamo glTF files to VRMA format by adding required extensions.
"""

import json
import os
import sys
from pathlib import Path

class GLTFToVRMAConverter:
    def __init__(self):
        # Load bone mapping
        mapping_path = Path(__file__).parent / "bone_mapping.json"
        with open(mapping_path, 'r', encoding='utf-8') as f:
            self.bone_mapping = json.load(f)
    
    def find_bone_index(self, nodes, bone_name):
        """Find the index of a bone in the nodes array"""
        for i, node in enumerate(nodes):
            if node.get("name") == bone_name:
                return i
        return None
    
    def convert_gltf_to_vrma(self, gltf_path):
        """Convert a glTF file to VRMA format"""
        print(f"Converting: {gltf_path}")
        
        # Load the glTF file
        with open(gltf_path, 'r', encoding='utf-8') as f:
            gltf_data = json.load(f)
        
        # Add extensionsUsed if not present
        if "extensionsUsed" not in gltf_data:
            gltf_data["extensionsUsed"] = []
        
        if "VRMC_vrm_animation" not in gltf_data["extensionsUsed"]:
            gltf_data["extensionsUsed"].append("VRMC_vrm_animation")
        
        # Ensure extensions object exists
        if "extensions" not in gltf_data:
            gltf_data["extensions"] = {}
        
        # Create humanoid bone mapping
        nodes = gltf_data.get("nodes", [])
        humanoid_bones = {}
        
        # Map required bones
        for mixamo_bone, vrm_bone in self.bone_mapping["mapping"].items():
            bone_index = self.find_bone_index(nodes, mixamo_bone)
            if bone_index is not None:
                humanoid_bones[vrm_bone] = {"node": bone_index}
                print(f"  Mapped {mixamo_bone} (index {bone_index}) -> {vrm_bone}")
        
        # Check if all required bones are found
        missing_bones = []
        for required_bone in self.bone_mapping["required_bones"]:
            if required_bone not in humanoid_bones:
                missing_bones.append(required_bone)
        
        if missing_bones:
            print(f"  Warning: Missing required bones: {missing_bones}")
        
        # Create VRMC_vrm_animation extension
        vrma_extension = {
            "specVersion": "1.0",
            "humanoid": {
                "humanBones": humanoid_bones
            }
        }
        
        gltf_data["extensions"]["VRMC_vrm_animation"] = vrma_extension
        
        # Save the modified glTF file
        with open(gltf_path, 'w', encoding='utf-8') as f:
            json.dump(gltf_data, f, indent=4, ensure_ascii=False)
        
        print(f"  Successfully converted {gltf_path} to VRMA format")
        print(f"  Mapped {len(humanoid_bones)} bones")
        return True
    
    def process_directory(self, directory_path):
        """Process all glTF files in a directory recursively"""
        directory = Path(directory_path)
        converted_count = 0
        
        for gltf_file in directory.rglob("*.gltf"):
            try:
                if self.convert_gltf_to_vrma(gltf_file):
                    converted_count += 1
            except Exception as e:
                print(f"Error converting {gltf_file}: {e}")
        
        print(f"\\nConversion complete! Processed {converted_count} files.")
        return converted_count

def main():
    if len(sys.argv) < 2:
        print("Usage: python gltf_to_vrma_converter.py <models_directory>")
        sys.exit(1)
    
    models_dir = sys.argv[1]
    if not os.path.exists(models_dir):
        print(f"Error: Directory {models_dir} not found!")
        sys.exit(1)
    
    converter = GLTFToVRMAConverter()
    converter.process_directory(models_dir)

if __name__ == "__main__":
    main()