import os
import sys
import tempfile
import unittest

os.environ['DB_PATH'] = os.path.join(tempfile.gettempdir(), 'coneccionsupabase_test.db')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

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


if __name__ == '__main__':
    unittest.main()
