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

    def make_admin_token(self):
        claims = {'id': 1, 'username': 'admin', 'tenant_id': 1, 'role': 'admin'}
        with patch.object(app_module, 'get_role_permissions', return_value=[]):
            return app_module.create_token(claims)

    def make_role_token(self, role):
        claims = {'id': 2, 'username': 'staff', 'tenant_id': 1, 'role': role}
        with patch.object(app_module, 'get_role_permissions', return_value=[]):
            return app_module.create_token(claims)

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

    def test_users_can_be_created_updated_and_deleted(self):
        token = self.make_admin_token()
        headers = {'Authorization': f'Bearer {token}'}
        user_columns = {'username', 'password', 'role', 'tenant_id', 'email', 'location_id'}
        roles = {'admin': {}, 'doctor': {}, 'nurse': {}, 'user': {}}

        with patch.object(app_module, 'has_permission', return_value=True), \
                patch.object(app_module, 'get_user_columns', return_value=user_columns), \
                patch.object(app_module, 'get_all_roles', return_value=roles), \
                patch.object(app_module, 'db_query', side_effect=[None, {'id': 27}]) as query, \
                patch.object(app_module, 'record_audit'):
            create_response = self.client.post(
                '/api/users',
                json={
                    'username': 'new-doctor',
                    'password': 'SecurePassword123',
                    'email': 'doctor@example.test',
                    'role': 'doctor',
                    'location_id': ''
                },
                headers=headers
            )

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.get_json()['id'], 27)
        self.assertEqual(query.call_count, 2)
        insert_values = query.call_args.args[1]
        self.assertEqual(insert_values[0], 'new-doctor')
        self.assertNotEqual(insert_values[1], 'SecurePassword123')
        self.assertEqual(insert_values[2:5], ('doctor', 1, 'doctor@example.test'))

        with patch.object(app_module, 'has_permission', return_value=True), \
                patch.object(app_module, 'get_user_columns', return_value=user_columns), \
                patch.object(app_module, 'get_all_roles', return_value=roles), \
                patch.object(app_module, 'db_query', side_effect=[None, {'id': 27}]) as query, \
                patch.object(app_module, 'record_audit'):
            update_response = self.client.put(
                '/api/users/27',
                json={
                    'username': 'renamed-doctor',
                    'role': 'doctor',
                    'email': 'updated@example.test',
                    'location_id': '',
                    'password': 'NewSecurePassword123'
                },
                headers=headers
            )

        self.assertEqual(update_response.status_code, 200)
        update_values = query.call_args.args[1]
        self.assertEqual(update_values[-2:], (27, 1))
        self.assertIn('renamed-doctor', update_values)
        self.assertIn('updated@example.test', update_values)
        self.assertNotIn('NewSecurePassword123', update_values)

        with patch.object(app_module, 'has_permission', return_value=True), \
                patch.object(app_module, 'db_query', return_value={'id': 27}), \
                patch.object(app_module, 'record_audit'):
            delete_response = self.client.delete('/api/users/27', headers=headers)

        self.assertEqual(delete_response.status_code, 200)

        with patch.object(app_module, 'has_permission', return_value=True), \
                patch.object(
                    app_module,
                    'db_query',
                    side_effect=app_module.psycopg2.IntegrityError('referenced user')
                ):
            blocked_delete_response = self.client.delete('/api/users/28', headers=headers)

        self.assertEqual(blocked_delete_response.status_code, 409)
        self.assertIn('related records', blocked_delete_response.get_json()['message'])

    def test_non_admin_cannot_access_admin_sections(self):
        token = self.make_role_token('doctor')
        headers = {'Authorization': f'Bearer {token}'}
        restricted_paths = [
            '/api/alerts',
            '/api/dashboard/areas',
            '/api/locations',
            '/api/devices',
            '/api/sessions',
            '/api/audit_logs',
            '/api/device_actions',
            '/api/reports',
            '/api/reports/series',
            '/api/metrics',
            '/api/metrics/details?type=users',
            '/api/users'
        ]

        with patch.object(app_module, 'db_query') as query:
            for path in restricted_paths:
                with self.subTest(path=path):
                    response = self.client.get(path, headers=headers)
                    self.assertEqual(response.status_code, 403)

        query.assert_not_called()

    def test_consultation_update_is_tenant_scoped_and_validates_priority(self):
        token = self.make_role_token('doctor')
        headers = {'Authorization': f'Bearer {token}'}

        with patch.object(app_module, 'db_query', return_value={'id': 17}) as query, \
                patch.object(app_module, 'record_audit'):
            response = self.client.put(
                '/api/consultations/17',
                json={
                    'doctor_name': 'Dra. Test',
                    'reason': 'Control',
                    'symptoms': 'Sin síntomas',
                    'diagnosis': 'Estable',
                    'treatment': 'Seguimiento',
                    'prescription': '',
                    'priority': 'Alta'
                },
                headers=headers
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(query.call_args.args[1][-2:], (17, 1))
        self.assertEqual(query.call_args.args[1][-3], 'Alta')
        self.assertIn('tenant_id = %s', query.call_args.args[0])

        with patch.object(app_module, 'db_query') as query:
            invalid_priority_response = self.client.put(
                '/api/consultations/17',
                json={'priority': 'Crítica'},
                headers=headers
            )
        self.assertEqual(invalid_priority_response.status_code, 400)
        query.assert_not_called()

    def test_non_admin_can_still_auto_register_its_device(self):
        token = self.make_role_token('doctor')
        with patch.object(app_module, 'db_query', side_effect=[None, {'id': 42}]), \
                patch.object(app_module, 'record_audit'):
            response = self.client.post(
                '/api/devices/auto-register',
                json={'platform': 'Win32'},
                headers={
                    'Authorization': f'Bearer {token}',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            )

        self.assertEqual(response.status_code, 200)

    def test_locations_list_does_not_require_user_location_column(self):
        token = self.make_admin_token()
        with patch.object(app_module, 'get_user_columns', return_value=set()) as user_columns, \
                patch.object(app_module, 'db_query', return_value=[]) as query:
            response = self.client.get(
                '/api/locations',
                headers={'Authorization': f'Bearer {token}'}
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [])
        user_columns.assert_not_called()
        self.assertIn('devices d', query.call_args.args[0])
        self.assertNotIn('u.location_id', query.call_args.args[0])

    def test_location_detail_counts_assigned_accounts_and_connected_devices(self):
        token = self.make_admin_token()
        expected = {
            'id': 7,
            'name': 'Urgencias',
            'user_count': 4,
            'device_count': 3,
            'accounts': [{'id': 15, 'username': 'clinician', 'role': 'doctor'}],
            'devices': [{
                'id': 22,
                'name': 'clinician - LAPTOP',
                'type': 'laptop',
                'status': 'active',
                'ip_address': '192.0.2.10',
                'account_username': 'clinician'
            }],
            'active_alerts': 1,
            'total_alerts': 2
        }

        with patch.object(app_module, 'get_user_columns', return_value={'location_id'}), \
                patch.object(app_module, 'db_query', return_value=expected) as query:
            response = self.client.get(
                '/api/locations/7',
                headers={'Authorization': f'Bearer {token}'}
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['user_count'], 4)
        self.assertEqual(response.get_json()['device_count'], 3)
        self.assertEqual(response.get_json()['accounts'][0]['username'], 'clinician')
        self.assertEqual(response.get_json()['devices'][0]['ip_address'], '192.0.2.10')
        sql = query.call_args.args[0]
        self.assertIn('u.location_id = l.id', sql)
        self.assertIn('COUNT(DISTINCT d.id)', sql)
        self.assertIn("da.action_type = 'connect'", sql)
        self.assertIn("da.entity_type = 'device'", sql)
        self.assertIn('AS accounts', sql)
        self.assertIn('AS devices', sql)

    def test_location_detail_requires_account_assignment_migration(self):
        token = self.make_admin_token()

        with patch.object(app_module, 'get_user_columns', return_value=set()), \
                patch.object(app_module, 'db_query') as query:
            response = self.client.get(
                '/api/locations/7',
                headers={'Authorization': f'Bearer {token}'}
            )

        self.assertEqual(response.status_code, 503)
        self.assertIn('migración', response.get_json()['message'])
        query.assert_not_called()

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
