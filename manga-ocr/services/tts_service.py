import edge_tts
from core.config import DEFAULT_VOICE

class TTSService:
    async def generate_audio(self, text: str, voice: str = DEFAULT_VOICE) -> bytes:
        try:
            communicate = edge_tts.Communicate(text, voice)
            audio_data = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data += chunk["data"]
            return audio_data
        except Exception as e:
            print(f"Erreur TTS : {e}")
            raise e

# Instance unique
tts_service = TTSService()
