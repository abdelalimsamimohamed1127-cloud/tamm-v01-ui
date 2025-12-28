from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseAutomationHandler(ABC):
    """
    Abstract base class for all automation handlers.
    Each handler is responsible for a single automation type.
    """

    @abstractmethod
    def execute(self, automation: Dict[str, Any], payload: Dict[str, Any]):
        """
        Executes the automation's action.

        :param automation: The automation database record, including its config.
        :param payload: The event payload that triggered the automation.
        """
        raise NotImplementedError

    def _validate_config(self, config: Dict[str, Any], required_keys: list[str]) -> bool:
        """
        A helper to validate that the required keys are present in the config.
        """
        if not config:
            return False
        for key in required_keys:
            if key not in config or not config[key]:
                return False
        return True
