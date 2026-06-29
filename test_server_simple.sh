#!/bin/bash
set -euo pipefail

echo "Testing server..."
# Test the API endpoint
response=$(curl -s -X POST http://127.0.0.1:8000/api/token -H "Content-Type: application/json" -d '{"model":"gemini-3.1-flash-live-preview"}')
echo "Response: $response"

# Check if systemPrompt is present
if echo "$response" | grep -q '"systemPrompt"'; then
    echo "✓ Server returns systemPrompt"
    system_prompt=$(echo "$response" | grep -o '"systemPrompt":"[^"]*"' | cut -d'"' -f4)
    echo "systemPrompt: ${system_prompt:0:100}..."
    if echo "$system_prompt" | grep -q "^<role_and_persona>"; then
        echo "✓ systemPrompt starts with '<role_and_persona>'"
    else
        echo "✗ systemPrompt does not start with '<role_and_persona>'"
        exit 1
    fi
else
    echo "✗ Server response does not contain 'systemPrompt' field"
    exit 1
fi

# Check system-prompt.md file
if [[ -f "system-prompt.md" ]]; then
    echo "✓ system-prompt.md exists"
    file_content=$(cat system-prompt.md)
    if echo "$file_content" | grep -q "^<role_and_persona>"; then
        echo "✓ system-prompt.md starts with '<role_and_persona>'"
    else
        echo "✗ system-prompt.md does not start with '<role_and_persona>'"
        exit 1
    fi
else
    echo "✗ system-prompt.md does not exist"
    exit 1
fi

echo "✓ All tests passed!"
