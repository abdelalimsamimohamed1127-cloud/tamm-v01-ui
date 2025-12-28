from rest_framework import serializers

class WorkspaceWalletDTO(serializers.Serializer):
    workspace_id = serializers.UUIDField()
    credits_remaining = serializers.IntegerField()
    credits_used = serializers.IntegerField()


class WorkspacePlanDTO(serializers.Serializer):
    workspace_id = serializers.UUIDField()
    plan_key = serializers.ChoiceField(
        choices=["free", "starter", "pro"]
    )
