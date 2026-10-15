import os
import sys
import tempfile
import unittest
from unittest.mock import patch

os.environ['DB_PATH'] = os.path.join(tempfile.gettempdir(), 'coneccionsupabase_test.db')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import app as app_module
from app import app


class AppTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_login_and_patients_endpoint(self):
        login_response = self.client.post('/api/login', json={
            'username': 'admin',
            'password': 'Admin123!'
        })
        self.assertEqual(login_response.status_code, 200)
        token = login_response.get_json()['token']

        patients_response = self.client.get('/api/patients', headers={
            'Authorization': f'Bearer {token}'
        })
        self.assertEqual(patients_response.status_code, 200)
        payload = patients_response.get_json()
        self.assertIsInstance(payload, list)
        self.assertGreaterEqual(len(payload), 1)

    def test_auto_register_uses_request_ip_and_logs_without_database_actions(self):
        claims = {
            'id': 1,
            'username': 'test-user',
            'tenant_id': 1,
            'role': 'admin'
        }
        with patch.object(app_module, 'get_role_permissions', return_value=[]):
            token = app_module.create_token(claims)

        with patch.object(app_module, 'db_query', side_effect=[None, {'id': 42}]) as query, \
                patch.object(app_module, 'record_audit') as audit:
            response = self.client.post(
                '/api/devices/auto-register',
                json={'platform': 'Win32'},
                headers={
                    'Authorization': f'Bearer {token}',
                    'X-Forwarded-For': '203.0.113.24, 10.0.0.1',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload['ip_address'], '203.0.113.24')
        self.assertEqual(payload['username'], 'test-user')
        self.assertEqual(payload['device_id'], 42)
        self.assertEqual(query.call_count, 2)
        audit.assert_called_once()


if __name__ == '__main__':
    unittest.main()
