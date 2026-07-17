import unittest

from hospital_management.auth import authenticate_user, get_available_modules


class PermissionTests(unittest.TestCase):
    def test_developer_has_all_modules(self):
        self.assertEqual(
            get_available_modules("developer"),
            ["staff", "patients", "appointments", "reports"],
        )

    def test_reception_only_sees_appointments(self):
        self.assertEqual(get_available_modules("reception"), ["appointments"])

    def test_authentication(self):
        self.assertTrue(authenticate_user("developer", "dev123"))
        self.assertFalse(authenticate_user("doctor", "wrong-password"))


if __name__ == "__main__":
    unittest.main()
