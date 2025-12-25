import uuid
from typing import Dict, Any, Literal
import datetime

class CanonicalModelFactory:
    """
    Factory to normalize raw data into canonical internal models.
    """
    CANONICAL_ENTITY_TYPES = Literal[
        "employee_profile",
        "employee_event",
        "employee_kpi",
        "employee_complaint",
        "policy_document",
    ]

    @staticmethod
    def normalize_data(
        workspace_id: uuid.UUID,
        source_connector_id: uuid.UUID,
        entity_type: CANONICAL_ENTITY_TYPES,
        raw_payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Normalizes a raw payload into a canonical data model.
        """
        base_record = {
            "workspace_id": workspace_id,
            "source_connector_id": source_connector_id,
            "source_reference": raw_payload.get("id", str(uuid.uuid4())), # Use external ID if available
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

        if entity_type == "employee_profile":
            return CanonicalModelFactory._normalize_employee_profile(base_record, raw_payload)
        elif entity_type == "employee_event":
            return CanonicalModelFactory._normalize_employee_event(base_record, raw_payload)
        elif entity_type == "employee_kpi":
            return CanonicalModelFactory._normalize_employee_kpi(base_record, raw_payload)
        elif entity_type == "employee_complaint":
            return CanonicalModelFactory._normalize_employee_complaint(base_record, raw_payload)
        elif entity_type == "policy_document":
            return CanonicalModelFactory._normalize_policy_document(base_record, raw_payload)
        else:
            raise ValueError(f"Unsupported canonical entity type: {entity_type}")

    @staticmethod
    def _normalize_employee_profile(base: Dict, raw: Dict) -> Dict:
        """Normalizes raw data into an employee profile."""
        profile = {
            **base,
            "external_id": raw.get("id"),
            "first_name": raw.get("first_name", raw.get("firstName")),
            "last_name": raw.get("last_name", raw.get("lastName")),
            "email": raw.get("email"),
            "phone": raw.get("phone"),
            "department": raw.get("department"),
            "job_title": raw.get("job_title", raw.get("jobTitle")),
            "status": raw.get("status", "active"),
            "start_date": raw.get("start_date", raw.get("startDate")),
            # PII masking hook - conceptual
            "email": CanonicalModelFactory._mask_pii_email(raw.get("email")),
            "phone": CanonicalModelFactory._mask_pii_phone(raw.get("phone")),
            "raw_data": raw # Store original for audit
        }
        return profile

    @staticmethod
    def _normalize_employee_event(base: Dict, raw: Dict) -> Dict:
        """Normalizes raw data into an employee event."""
        event = {
            **base,
            "event_type": raw.get("event_type", raw.get("eventType")),
            "event_date": raw.get("event_date", raw.get("eventDate")),
            "employee_id": raw.get("employee_id", raw.get("employeeId")),
            "description": raw.get("description"),
            "raw_data": raw
        }
        return event

    @staticmethod
    def _normalize_employee_kpi(base: Dict, raw: Dict) -> Dict:
        """Normalizes raw data into an employee KPI."""
        kpi = {
            **base,
            "kpi_name": raw.get("kpi_name", raw.get("kpiName")),
            "value": raw.get("value"),
            "period": raw.get("period"),
            "employee_id": raw.get("employee_id", raw.get("employeeId")),
            "raw_data": raw
        }
        return kpi

    @staticmethod
    def _normalize_employee_complaint(base: Dict, raw: Dict) -> Dict:
        """Normalizes raw data into an employee complaint."""
        complaint = {
            **base,
            "title": raw.get("title"),
            "description": raw.get("description"),
            "status": raw.get("status", "open"),
            "reported_by": raw.get("reported_by", raw.get("reportedBy")),
            "reported_date": raw.get("reported_date", raw.get("reportedDate")),
            "employee_id": raw.get("employee_id", raw.get("employeeId")),
            "raw_data": raw
        }
        # PII masking hook
        complaint["description"] = CanonicalModelFactory._mask_pii_text(complaint["description"])
        return complaint

    @staticmethod
    def _normalize_policy_document(base: Dict, raw: Dict) -> Dict:
        """Normalizes raw data into a policy document."""
        policy = {
            **base,
            "title": raw.get("title"),
            "content": raw.get("content"),
            "version": raw.get("version"),
            "effective_date": raw.get("effective_date", raw.get("effectiveDate")),
            "category": raw.get("category"),
            "raw_data": raw
        }
        return policy

    @staticmethod
    def _mask_pii_email(email: Optional[str]) -> Optional[str]:
        if email:
            parts = email.split('@')
            if len(parts) == 2:
                return f"{parts[0][0]}***@{parts[1]}"
        return email

    @staticmethod
    def _mask_pii_phone(phone: Optional[str]) -> Optional[str]:
        if phone and len(phone) > 4:
            return f"***-***-{phone[-4:]}"
        return phone

    @staticmethod
    def _mask_pii_text(text: Optional[str]) -> Optional[str]:
        # Placeholder for more advanced text PII masking
        return text
