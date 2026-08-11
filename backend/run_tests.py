from app import app
import json

client = app.test_client()

print('Starting integration tests')

# Register a test user
username = 'int_test_user'
password = 'Test123!'
resp = client.post('/api/register', json={'username': username, 'password': password, 'role': 'admin'})
print('register status', resp.status_code, resp.get_json())

# Login
resp = client.post('/api/login', json={'username': username, 'password': password})
print('login status', resp.status_code)
if resp.status_code == 200:
    data = resp.get_json()
    token = data.get('token')
    headers = {'Authorization': f'Bearer {token}'}
    # Profile
    r = client.get('/api/profile', headers=headers)
    print('/api/profile', r.status_code, r.get_json())

    # Create an incident
    r = client.post('/api/incidents', headers=headers, json={'incident_type': 'test_issue', 'description': 'Integration test incident'})
    print('/api/incidents POST', r.status_code, r.get_json())

    # List incidents
    r = client.get('/api/incidents', headers=headers)
    print('/api/incidents GET', r.status_code, r.get_json())

    # Get reports
    r = client.get('/api/reports', headers=headers)
    print('/api/reports', r.status_code, r.get_json())

    # Get metrics
    r = client.get('/api/metrics', headers=headers)
    print('/api/metrics', r.status_code, r.get_json())

    # Device actions list (likely empty)
    r = client.get('/api/device_actions', headers=headers)
    print('/api/device_actions', r.status_code, r.get_json())

    # Export CSV (should return text/csv)
    r = client.get('/api/device_actions/export', headers=headers)
    print('/api/device_actions/export', r.status_code, 'content-type=', r.content_type)
else:
    print('Login failed; aborting further tests')
