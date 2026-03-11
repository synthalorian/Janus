"""Exceptions for Janus SDK."""


class JanusError(Exception):
    """Base exception for Janus SDK errors."""
    
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class AuthenticationError(JanusError):
    """Raised when authentication fails."""
    pass


class ConnectionError(JanusError):
    """Raised when connection to Janus fails."""
    pass


class MessageError(JanusError):
    """Raised when message operations fail."""
    pass


class GraphError(JanusError):
    """Raised when graph operations fail."""
    pass


class SearchError(JanusError):
    """Raised when search operations fail."""
    pass
