import os


class Settings:
    def __init__(self) -> None:
        self.OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.IDLE_TIMEOUT_MINUTES: int = self._get_int("IDLE_TIMEOUT_MINUTES", 5)

    @staticmethod
    def _get_int(key: str, default: int) -> int:
        raw_value = os.getenv(key)
        if raw_value is None:
            return default

        try:
            return int(raw_value)
        except ValueError:
            return default


settings = Settings()