#!/bin/bash

# Test payload
PAYLOAD='{"message":{"type":"function-call","functionCall":{"name":"generate_interview_questions","parameters":{"role":"Software Engineer","interview_type":"Technical","experience_level":"Mid-level","question_count":3,"technologies":"JavaScript, React, Node.js"}}}}'

# Generate signature using the webhook secret
SECRET="5bb0210b0eb58895fc76c7a06746336a84960769a0b1dba36eacda39b1311767"
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | cut -d' ' -f2)

echo "Testing webhook with payload:"
echo "$PAYLOAD" | jq .
echo ""
echo "Generated signature: $SIGNATURE"
echo ""

# Make the request
echo "Making webhook request..."
curl -X POST "https://www.prepbettr.com/api/vapi/webhook" \
  -H "Content-Type: application/json" \
  -H "x-vapi-signature: $SIGNATURE" \
  -d "$PAYLOAD" \
  -v
