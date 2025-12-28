# backend/integrations/serializers.py

from rest_framework import serializers

class ConnectorSerializer(serializers.Serializer):
    """
    Serializer for creating and updating connector instances.
    Note: This serializer does NOT handle sensitive config fields (e.g., API keys, secrets).
    """
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(max_length=255)
    type = serializers.CharField(max_length=50) # e.g. 'google_sheets', 'custom_api'
    domain = serializers.CharField(max_length=50, required=False, allow_blank=True, default='other') # e.g. 'hr', 'crm', 'erp', 'other'
    auth_type = serializers.CharField(max_length=50, required=False, allow_blank=True, default='api_key') # e.g. 'api_key', 'oauth', 'service_account'
    sync_mode = serializers.CharField(max_length=50, required=False, allow_blank=True, default='manual') # e.g. 'manual', 'scheduled'
    status = serializers.CharField(max_length=50, read_only=True) # 'inactive', 'active', 'error'
    last_sync_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    # config field will store non-sensitive details like domain, auth_type, sync_mode
    # Sensitive config (secrets) are handled separately in backend/integrations/views.py
    # or by specialized serializers that interact with a secrets manager.
    config = serializers.JSONField(required=False, default=dict)

    class Meta:
        fields = '__all__' # Placeholder, actual fields defined above


class ConnectorCreateUpdateSerializer(serializers.Serializer):
    """
    Serializer for validating data when creating or updating a connector.
    Ensures non-sensitive initial configuration.
    """
    name = serializers.CharField(max_length=255)
    type = serializers.CharField(max_length=50)
    domain = serializers.CharField(max_length=50, required=False, allow_blank=True, default='other')
    auth_type = serializers.CharField(max_length=50, required=False, allow_blank=True, default='api_key')
    sync_mode = serializers.CharField(max_length=50, required=False, allow_blank=True, default='manual')
    # Add other non-sensitive config fields if the wizard collects them.
    # The actual 'config' JSONB field in DB will be constructed from these.

    def validate(self, data):
        # Basic validation for connector types and domains
        valid_types = ['google_sheets', 'custom_api', 'hr_system', 'crm_system', 'erp_system']
        if data['type'] not in valid_types:
            raise serializers.ValidationError(f"Invalid connector type. Must be one of: {', '.join(valid_types)}")
        
        valid_domains = ['hr', 'crm', 'erp', 'other']
        if data['domain'] not in valid_domains:
            raise serializers.ValidationError(f"Invalid connector domain. Must be one of: {', '.join(valid_domains)}")

        valid_auth_types = ['api_key', 'oauth', 'service_account']
        if data['auth_type'] not in valid_auth_types:
            raise serializers.ValidationError(f"Invalid auth type. Must be one of: {', '.join(valid_auth_types)}")

        valid_sync_modes = ['manual', 'scheduled']
        if data['sync_mode'] not in valid_sync_modes:
            raise serializers.ValidationError(f"Invalid sync mode. Must be one of: {', '.join(valid_sync_modes)}")
        
        return data


class SyncTriggerSerializer(serializers.Serializer):
    """
    Serializer for triggering a connector sync.
    """
    # No fields expected in the body for a simple sync trigger
    pass
