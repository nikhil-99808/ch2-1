"""Minimal async client for Groq's OpenAI-compatible Chat Completions endpoint."""
import httpx
from .config import GROQ_API_KEY, GROQ_API_URL, GROQ_MODEL


class GroqNotConfigured(RuntimeError):
    pass


class GroqRequestError(RuntimeError):
    pass


async def chat(messages: list[dict[str, str]], *, json_mode: bool = False, temperature: float = 0.35) -> str:
    if not GROQ_API_KEY:
        raise GroqNotConfigured("Groq API key is not configured. Add GROQ_API_KEY to the project's .env file and restart the server.")
    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 1600,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(75.0, connect=15.0)) as client:
            response = await client.post(GROQ_API_URL, headers=headers, json=payload)
    except httpx.TimeoutException as exc:
        raise GroqRequestError("Groq did not respond before the request timed out. Please try again.") from exc
    except httpx.HTTPError as exc:
        raise GroqRequestError(f"Could not reach Groq: {exc.__class__.__name__}.") from exc

    if response.status_code >= 400:
        try:
            detail = response.json().get("error", {}).get("message", response.text[:300])
        except ValueError:
            detail = response.text[:300]
        raise GroqRequestError(f"Groq API returned {response.status_code}: {detail}")
    try:
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise GroqRequestError("Groq returned a response in an unexpected format.") from exc
