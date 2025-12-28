import unittest
from unittest.mock import Mock, patch
import uuid
from backend.agents.runtime import get_agent_runtime_config
from backend.agents.supabase_repo import SupabaseRepo
from rest_framework import exceptions

class GetAgentRuntimeConfigTest(unittest.TestCase):

    def setUp(self):
        self.mock_supabase_repo = Mock(spec=SupabaseRepo)
        self.agent_id = uuid.uuid4()
        self.workspace_id = uuid.uuid4()
        self.base_system_prompt = "Base system prompt."
        self.base_rules_jsonb = {"rule1": "base", "rule2": "base"}

        self.mock_base_agent_config = {
            "id": self.agent_id,
            "system_prompt": self.base_system_prompt,
            "rules_jsonb": self.base_rules_jsonb,
            "draft_version_id": None,
            "published_version_id": None,
        }
        self.mock_supabase_repo.get_base_agent_config.return_value = self.mock_base_agent_config

    def _mock_version_config(self, version_id, system_prompt=None, rules_jsonb=None):
        mock_version = {
            "id": version_id,
            "system_prompt": system_prompt if system_prompt is not None else f"Version {version_id} prompt.",
            "rules_jsonb": rules_jsonb if rules_jsonb is not None else {"version_rule": str(version_id)},
        }
        self.mock_supabase_repo.get_agent_version_config.return_value = mock_version
        return mock_version

    def test_1_agent_with_no_versions_fallback_live(self):
        """Test agent with no versions, live mode should fallback to base."""
        self.mock_base_agent_config["draft_version_id"] = None
        self.mock_base_agent_config["published_version_id"] = None

        config = get_agent_runtime_config(self.mock_supabase_repo, self.agent_id, self.workspace_id, "live")

        self.assertEqual(config["system_prompt"], self.base_system_prompt)
        self.assertEqual(config["rules"], self.base_rules_jsonb)
        self.assertIsNone(config["version_id"])
        self.mock_supabase_repo.get_base_agent_config.assert_called_once_with(self.agent_id, self.workspace_id)
        self.mock_supabase_repo.get_agent_version_config.assert_not_called()

    def test_2_agent_with_no_versions_fallback_preview(self):
        """Test agent with no versions, preview mode should fallback to base."""
        self.mock_base_agent_config["draft_version_id"] = None
        self.mock_base_agent_config["published_version_id"] = None

        config = get_agent_runtime_config(self.mock_supabase_repo, self.agent_id, self.workspace_id, "preview")

        self.assertEqual(config["system_prompt"], self.base_system_prompt)
        self.assertEqual(config["rules"], self.base_rules_jsonb)
        self.assertIsNone(config["version_id"])
        self.mock_supabase_repo.get_base_agent_config.assert_called_once_with(self.agent_id, self.workspace_id)
        self.mock_supabase_repo.get_agent_version_config.assert_not_called()

    def test_3_agent_with_only_draft_version_preview(self):
        """Test agent with only draft version, preview mode uses draft."""
        draft_version_id = uuid.uuid4()
        draft_system_prompt = "Draft system prompt."
        draft_rules_jsonb = {"rule1": "draft"}
        self.mock_base_agent_config["draft_version_id"] = draft_version_id
        self.mock_base_agent_config["published_version_id"] = None
        self.mock_supabase_repo.get_agent_version_config.return_value = {
            "system_prompt": draft_system_prompt,
            "rules_jsonb": draft_rules_jsonb,
        }

        config = get_agent_runtime_config(self.mock_supabase_repo, self.agent_id, self.workspace_id, "preview")

        self.assertEqual(config["system_prompt"], draft_system_prompt)
        self.assertEqual(config["rules"], draft_rules_jsonb)
        self.assertEqual(config["version_id"], str(draft_version_id))
        self.mock_supabase_repo.get_base_agent_config.assert_called_once()
        self.mock_supabase_repo.get_agent_version_config.assert_called_once_with(draft_version_id)

    def test_4_agent_with_only_draft_version_live_fallback(self):
        """Test agent with only draft version, live mode falls back to base."""
        draft_version_id = uuid.uuid4()
        draft_system_prompt = "Draft system prompt."
        draft_rules_jsonb = {"rule1": "draft"}
        self.mock_base_agent_config["draft_version_id"] = draft_version_id
        self.mock_base_agent_config["published_version_id"] = None
        # Mock get_agent_version_config to return for draft, but it shouldn't be called for published
        self.mock_supabase_repo.get_agent_version_config.side_effect = lambda v_id: {
            "system_prompt": draft_system_prompt, "rules_jsonb": draft_rules_jsonb
        } if v_id == draft_version_id else exceptions.NotFound()

        config = get_agent_runtime_config(self.mock_supabase_repo, self.agent_id, self.workspace_id, "live")

        self.assertEqual(config["system_prompt"], self.base_system_prompt)
        self.assertEqual(config["rules"], self.base_rules_jsonb)
        self.assertIsNone(config["version_id"]) # No published version used
        self.mock_supabase_repo.get_base_agent_config.assert_called_once()
        # get_agent_version_config should not be called as published_version_id is None
        self.mock_supabase_repo.get_agent_version_config.assert_not_called()


    def test_5_agent_with_only_published_version_live(self):
        """Test agent with only published version, live mode uses published."""
        published_version_id = uuid.uuid4()
        published_system_prompt = "Published system prompt."
        published_rules_jsonb = {"rule1": "published"}
        self.mock_base_agent_config["draft_version_id"] = None
        self.mock_base_agent_config["published_version_id"] = published_version_id
        self.mock_supabase_repo.get_agent_version_config.return_value = {
            "system_prompt": published_system_prompt,
            "rules_jsonb": published_rules_jsonb,
        }

        config = get_agent_runtime_config(self.mock_supabase_repo, self.agent_id, self.workspace_id, "live")

        self.assertEqual(config["system_prompt"], published_system_prompt)
        self.assertEqual(config["rules"], published_rules_jsonb)
        self.assertEqual(config["version_id"], str(published_version_id))
        self.mock_supabase_repo.get_base_agent_config.assert_called_once()
        self.mock_supabase_repo.get_agent_version_config.assert_called_once_with(published_version_id)

    def test_6_agent_with_only_published_version_preview_fallback(self):
        """Test agent with only published version, preview mode falls back to base."""
        published_version_id = uuid.uuid4()
        published_system_prompt = "Published system prompt."
        published_rules_jsonb = {"rule1": "published"}
        self.mock_base_agent_config["draft_version_id"] = None
        self.mock_base_agent_config["published_version_id"] = published_version_id
        # Mock get_agent_version_config to return for published, but it shouldn't be called for draft
        self.mock_supabase_repo.get_agent_version_config.side_effect = lambda v_id: {
            "system_prompt": published_system_prompt, "rules_jsonb": published_rules_jsonb
        } if v_id == published_version_id else exceptions.NotFound()


        config = get_agent_runtime_config(self.mock_supabase_repo, self.agent_id, self.workspace_id, "preview")

        self.assertEqual(config["system_prompt"], self.base_system_prompt)
        self.assertEqual(config["rules"], self.base_rules_jsonb)
        self.assertIsNone(config["version_id"]) # No draft version used
        self.mock_supabase_repo.get_base_agent_config.assert_called_once()
        # get_agent_version_config should not be called as draft_version_id is None
        self.mock_supabase_repo.get_agent_version_config.assert_not_called()

    def test_7_agent_with_both_versions_preview_uses_draft(self):
        """Test agent with both versions, preview mode uses draft."""
        draft_version_id = uuid.uuid4()
        published_version_id = uuid.uuid4()
        draft_system_prompt = "Draft system prompt."
        draft_rules_jsonb = {"rule1": "draft"}
        published_system_prompt = "Published system prompt."
        published_rules_jsonb = {"rule1": "published"}

        self.mock_base_agent_config["draft_version_id"] = draft_version_id
        self.mock_base_agent_config["published_version_id"] = published_version_id
        self.mock_supabase_repo.get_agent_version_config.side_effect = [
            {"system_prompt": draft_system_prompt, "rules_jsonb": draft_rules_jsonb}, # For draft
            {"system_prompt": published_system_prompt, "rules_jsonb": published_rules_jsonb}, # For published
        ]

        config = get_agent_runtime_config(self.mock_supabase_repo, self.agent_id, self.workspace_id, "preview")

        self.assertEqual(config["system_prompt"], draft_system_prompt)
        self.assertEqual(config["rules"], draft_rules_jsonb)
        self.assertEqual(config["version_id"], str(draft_version_id))
        self.mock_supabase_repo.get_base_agent_config.assert_called_once()
        self.mock_supabase_repo.get_agent_version_config.assert_called_once_with(draft_version_id)

    def test_8_agent_with_both_versions_live_uses_published(self):
        """Test agent with both versions, live mode uses published."""
        draft_version_id = uuid.uuid4()
        published_version_id = uuid.uuid4()
        draft_system_prompt = "Draft system prompt."
        draft_rules_jsonb = {"rule1": "draft"}
        published_system_prompt = "Published system prompt."
        published_rules_jsonb = {"rule1": "published"}

        self.mock_base_agent_config["draft_version_id"] = draft_version_id
        self.mock_base_agent_config["published_version_id"] = published_version_id
        self.mock_supabase_repo.get_agent_version_config.side_effect = [
            {"system_prompt": published_system_prompt, "rules_jsonb": published_rules_jsonb}, # For published
            {"system_prompt": draft_system_prompt, "rules_jsonb": draft_rules_jsonb}, # For draft (if called, which it shouldn't be for live mode)
        ]

        config = get_agent_runtime_config(self.mock_supabase_repo, self.agent_id, self.workspace_id, "live")

        self.assertEqual(config["system_prompt"], published_system_prompt)
        self.assertEqual(config["rules"], published_rules_jsonb)
        self.assertEqual(config["version_id"], str(published_version_id))
        self.mock_supabase_repo.get_base_agent_config.assert_called_once()
        self.mock_supabase_repo.get_agent_version_config.assert_called_once_with(published_version_id)

    def test_9_missing_draft_version_fallback_preview(self):
        """Test preview mode with draft_version_id present but version not found, fallback to base."""
        draft_version_id = uuid.uuid4()
        self.mock_base_agent_config["draft_version_id"] = draft_version_id
        self.mock_supabase_repo.get_agent_version_config.side_effect = exceptions.NotFound("Version not found")

        config = get_agent_runtime_config(self.mock_supabase_repo, self.agent_id, self.workspace_id, "preview")

        self.assertEqual(config["system_prompt"], self.base_system_prompt)
        self.assertEqual(config["rules"], self.base_rules_jsonb)
        self.assertIsNone(config["version_id"]) # Fallback means no version_id used
        self.mock_supabase_repo.get_base_agent_config.assert_called_once()
        self.mock_supabase_repo.get_agent_version_config.assert_called_once_with(draft_version_id)

    def test_10_missing_published_version_fallback_live(self):
        """Test live mode with published_version_id present but version not found, fallback to base."""
        published_version_id = uuid.uuid4()
        self.mock_base_agent_config["published_version_id"] = published_version_id
        self.mock_supabase_repo.get_agent_version_config.side_effect = exceptions.NotFound("Version not found")

        config = get_agent_runtime_config(self.mock_supabase_repo, self.agent_id, self.workspace_id, "live")

        self.assertEqual(config["system_prompt"], self.base_system_prompt)
        self.assertEqual(config["rules"], self.base_rules_jsonb)
        self.assertIsNone(config["version_id"]) # Fallback means no version_id used
        self.mock_supabase_repo.get_base_agent_config.assert_called_once()
        self.mock_supabase_repo.get_agent_version_config.assert_called_once_with(published_version_id)

    def test_11_base_agent_not_found(self):
        """Test case where the base agent itself is not found."""
        self.mock_supabase_repo.get_base_agent_config.side_effect = exceptions.NotFound("Agent not found")

        with self.assertRaises(exceptions.NotFound):
            get_agent_runtime_config(self.mock_supabase_repo, self.agent_id, self.workspace_id, "live")
        self.mock_supabase_repo.get_base_agent_config.assert_called_once_with(self.agent_id, self.workspace_id)
        self.mock_supabase_repo.get_agent_version_config.assert_not_called()

    def test_12_base_agent_config_has_none_rules(self):
        """Test when base agent config has None for rules_jsonb."""
        self.mock_base_agent_config["rules_jsonb"] = None
        config = get_agent_runtime_config(self.mock_supabase_repo, self.agent_id, self.workspace_id, "live")
        self.assertEqual(config["rules"], {}) # Should fallback to empty dict
        self.assertEqual(config["system_prompt"], self.base_system_prompt)
        self.assertIsNone(config["version_id"])

    def test_13_version_config_has_none_rules(self):
        """Test when version config has None for rules_jsonb."""
        draft_version_id = uuid.uuid4()
        draft_system_prompt = "Draft system prompt."
        self.mock_base_agent_config["draft_version_id"] = draft_version_id
        self.mock_supabase_repo.get_agent_version_config.return_value = {
            "system_prompt": draft_system_prompt,
            "rules_jsonb": None,
        }

        config = get_agent_runtime_config(self.mock_supabase_repo, self.agent_id, self.workspace_id, "preview")
        self.assertEqual(config["system_prompt"], draft_system_prompt)
        self.assertEqual(config["rules"], {}) # Should fallback to empty dict
        self.assertEqual(config["version_id"], str(draft_version_id))

if __name__ == '__main__':
    unittest.main()