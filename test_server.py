import subprocess
import time
import requests
import sys

# Start the server
print("Starting server...")
process = subprocess.Popen(['python', 'server.py'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

# Wait for server to start
time.sleep(3)

# Test the API
try:
    print("Testing /api/token endpoint...")
    response = requests.post('http://127.0.0.1:8000/api/token', 
                           json={'model': 'gemini-3.1-flash-live-preview'})
    print(f"Status code: {response.status_code}")
    print(f"Response: {response.text[:200]}...")
    
    if response.status_code == 200:
        data = response.json()
        if 'systemPrompt' in data:
            print(f"✓ Server returns systemPrompt")
            print(f"  First 100 chars: {data['systemPrompt'][:100]}...")
            if data['systemPrompt'].startswith('<role_and_persona>'):
                print("✓ systemPrompt starts with '<role_and_persona>'")
            else:
                print("✗ systemPrompt does not start with '<role_and_persona>'")
                sys.exit(1)
        else:
            print("✗ Server response does not contain 'systemPrompt' field")
            sys.exit(1)
    else:
        print(f"✗ Server returned status code {response.status_code}")
        sys.exit(1)
        
except Exception as e:
    print(f"✗ Error: {e}")
    sys.exit(1)
finally:
    # Kill the server
    process.terminate()
    process.wait()
    print("Server stopped")
