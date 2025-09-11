# OpenAI tool calling with history 
### Uses a sample function
import yaml
import gradio as gr
import json
import os
from openai import OpenAI
from dotenv import load_dotenv
load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")

with open('character_config.yaml', 'r') as f:
    char_config = yaml.safe_load(f)


client = OpenAI(api_key=openai_api_key)

# Constants
HISTORY_FILE = char_config['history_file']
MODEL = char_config['model']
SYSTEM_PROMPT =  [
        {
            "role": "system",
            "content": [
                {
                    "type": "input_text",
                    "text": char_config['presets']['default']['system_prompt']  
                }
            ]
        }
    ]


# REPLACE THIS FUNCTINO WITH ANY LOCAL LLM THAT ACCEPTS AN INPUT OR OUTPUT!!! LOOK IN process/llm_src.py
def get_riko_response_no_tool(messages):

    # Call OpenAI with system prompt + history
    response = client.responses.create(
        model=MODEL,
        input= messages,
        temperature=1,
        top_p=1,
        max_output_tokens=2048,
        stream=False,
        text={
            "format": {
            "type": "text"
            }
        },
    )

    return response



if __name__ == "__main__":

    user_message = "would you rather have 1 million dollars or a vacation with me?"

    response = get_riko_response_no_tool(user_message)

    print(response)
