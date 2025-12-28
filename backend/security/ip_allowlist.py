# backend/security/ip_allowlist.py

import ipaddress

def is_ip_allowed(ip_address_str: str, allowed_ips_config: list) -> bool:
    """
    Checks if a given IP address is within the allowed IP ranges.

    Args:
        ip_address_str: The IP address string to check (e.g., "192.168.1.1").
        allowed_ips_config: A list of CIDR strings or IP address strings representing
                            the allowed IP ranges/addresses (e.g., ["192.168.1.0/24", "10.0.0.1/32"]).

    Returns:
        True if the IP address is allowed, False otherwise.
    """
    if not allowed_ips_config:
        # If no allowed IPs are configured, all IPs are allowed (fail-safe).
        return True

    try:
        ip_to_check = ipaddress.ip_address(ip_address_str)
    except ValueError:
        # Invalid IP address string provided
        return False

    for allowed_range_str in allowed_ips_config:
        try:
            network = ipaddress.ip_network(allowed_range_str, strict=False)
            if ip_to_check in network:
                return True
        except ValueError:
            # Invalid CIDR or IP address string in the config, ignore and continue
            continue
            
    return False
