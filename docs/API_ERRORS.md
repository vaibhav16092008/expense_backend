# ExpenseIQ Backend — API Standard Error Contract

The ExpenseIQ API uses a consistent JSON response envelope for all error responses across validation, authentication, authorization, rate limiting, and server errors.

---

## 1. Standard Error Envelope Structure

All error responses return `success: false` and a human-readable `message`:

```json
{
  "success": false,
  "message": "Error description text"
}
```

Response headers automatically include `X-Request-ID` for log correlation:
```text
X-Request-ID: e62b71ef-38b4-4b5a-a38f-9a1b415e9821
```

---

## 2. Common HTTP Status Codes & Error Examples

### 400 Bad Request (Validation Error)
Triggered when request payload fails Zod schema validation or business constraints.

```json
{
  "success": false,
  "message": "Invalid email address format"
}
```

### 401 Unauthorized (Authentication Failure)
Triggered when JWT token is missing, invalid, or expired.

```json
{
  "success": false,
  "message": "Invalid or expired access token"
}
```

### 403 Forbidden (Authorization Failure)
Triggered when accessing resources owned by another user.

```json
{
  "success": false,
  "message": "Access denied: insufficient permissions"
}
```

### 404 Not Found
Triggered when requested endpoint route or resource ID does not exist.

```json
{
  "success": false,
  "message": "Route not found: GET /api/nonexistent"
}
```

### 413 Payload Too Large
Triggered when request body exceeds the 100KB size limit.

```json
{
  "success": false,
  "message": "Request body size exceeds 100kb limit"
}
```

### 429 Too Many Requests (Rate Limit Exceeded)
Triggered when authentication or sensitive user endpoint threshold is exceeded.

```json
{
  "success": false,
  "message": "Too many authentication attempts, please try again later"
}
```

### 500 Internal Server Error (Sanitized)
In production, unexpected internal server errors are logged internally with stack traces and correlated with `X-Request-ID`, but sanitized for the client.

```json
{
  "success": false,
  "message": "Internal server error"
}
```
