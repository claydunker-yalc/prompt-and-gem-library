import anthropic
from config import ANTHROPIC_API_KEY

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def generate_prompt_description(prompt_text: str) -> str:
    """
    Generate a description of what a prompt does using Claude.

    Args:
        prompt_text: The full prompt text to analyze

    Returns:
        A 1-2 sentence description of the prompt's purpose and use case
    """
    max_chars = 4000
    truncated_text = prompt_text[:max_chars] if len(prompt_text) > max_chars else prompt_text

    message = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=200,
        messages=[
            {
                "role": "user",
                "content": f"""Describe what this prompt does in 1-2 sentences. Focus on its purpose and intended use case.

Prompt:
{truncated_text}

Description:"""
            }
        ]
    )

    return message.content[0].text.strip()
