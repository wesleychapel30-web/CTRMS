from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
import json

from core.models import AuditLog, Notification, NotificationReceipt, PasswordResetToken, Permission, RoleDefinition, RolePermission, UserRole
from core.rbac_defaults import seed_rbac_defaults
from common.models import OrganizationSettings, SystemSettings
from requests.models import Request


User = get_user_model()


class PasswordResetTokenTests(TestCase):
    def test_create_for_user_invalidates_previous_unused_tokens(self):
        user = User.objects.create_user(
            username='alice',
            email='alice@example.com',
            password='StrongPass1',
        )
        first = PasswordResetToken.create_for_user(user, expires_in_hours=1)
        second = PasswordResetToken.create_for_user(user, expires_in_hours=2)

        first.refresh_from_db()

        self.assertTrue(first.is_used)
        self.assertEqual(second.user, user)
        self.assertEqual(second.email, user.email)
        self.assertGreater(second.expires_at, timezone.now() + timedelta(hours=1, minutes=50))


class FrontendAppSmokeTests(TestCase):
    def test_root_serves_react_application(self):
        response = self.client.get('/')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div id="root"></div>', html=False)


class CoreApiTests(TestCase):
    def setUp(self):
        seed_rbac_defaults()

    def test_session_status_returns_authenticated_user(self):
        user = User.objects.create_user(
            username='dashboard-user',
            email='dashboard@example.com',
            password='StrongPass1',
        )
        client = Client()
        client.force_login(user)

        response = client.get(reverse('api_session_status'))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['authenticated'])
        self.assertEqual(response.json()['user']['username'], 'dashboard-user')

    def test_dashboard_overview_returns_stats(self):
        user = User.objects.create_user(
            username='api-user',
            email='api@example.com',
            password='StrongPass1',
            role=User.Role.ADMIN,
            is_staff=True,
        )
        Request.objects.create(
            applicant_name='API Request',
            applicant_email='request@example.com',
            applicant_phone='0712345678',
            address='Nairobi',
            category=Request.Category.MEDICAL,
            description='Testing',
            amount_requested=2500,
            created_by=user,
        )
        client = Client()
        client.force_login(user)

        response = client.get(reverse('api_dashboard_overview'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['success'])
        self.assertEqual(payload['stats']['total_requests'], 1)

    def test_session_permissions_include_additional_roles(self):
        user = User.objects.create_user(
            username='multi-role-session',
            email='multi-role-session@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
        )
        role_admin = RoleDefinition.objects.get(key=User.Role.ADMIN)
        UserRole.objects.create(user=user, role=role_admin)

        client = Client()
        client.force_login(user)
        response = client.get(reverse('api_session_status'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        permissions = payload['user']['permissions']
        self.assertIn('user:manage', permissions)
        self.assertIn('request:create', permissions)
        self.assertIn(User.Role.ADMIN, payload['user']['roles'])

    def test_staff_session_permissions_hide_admin_and_director_actions(self):
        staff = User.objects.create_user(
            username='staff-session',
            email='staff-session@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
        )

        client = Client()
        client.force_login(staff)
        response = client.get(reverse('api_session_status'))

        self.assertEqual(response.status_code, 200)
        permissions = response.json()['user']['permissions']
        self.assertNotIn('audit:view', permissions)
        self.assertNotIn('dashboard:view', permissions)
        self.assertNotIn('search:global', permissions)
        self.assertNotIn('user:manage', permissions)
        self.assertNotIn('rbac:manage', permissions)
        self.assertNotIn('request:create', permissions)
        self.assertNotIn('invitation:create', permissions)
        self.assertNotIn('request:approve', permissions)
        self.assertNotIn('request:reject', permissions)
        self.assertIn('profile:change_password', permissions)

    def test_public_branding_endpoint_returns_active_branding(self):
        OrganizationSettings.objects.create(
            organization_name='Brand Org',
            organization_email='brand@example.com',
            is_active=True,
            primary_color='#112233',
            secondary_color='#334455',
        )
        SystemSettings.objects.create(
            site_name='Brand Site',
            organization_name='Brand Org',
            organization_email='brand@example.com',
            support_email='support@example.com',
        )

        response = self.client.get(reverse('api_public_branding'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['success'])
        self.assertEqual(payload['branding']['site_name'], 'Brand Site')
        self.assertEqual(payload['branding']['organization_name'], 'Brand Org')


class StaffAccessControlTests(TestCase):
    def setUp(self):
        seed_rbac_defaults()
        self.staff = User.objects.create_user(
            username='staff-user',
            email='staff@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
        )

    def test_staff_cannot_view_activity_logs(self):
        client = Client()
        client.force_login(self.staff)
        response = client.get(reverse('api_activity_logs_data'))
        self.assertEqual(response.status_code, 403)

    def test_staff_cannot_view_user_management_data(self):
        client = Client()
        client.force_login(self.staff)
        response = client.get(reverse('api_user_management_data'))
        self.assertEqual(response.status_code, 403)

    def test_staff_cannot_view_rbac_permissions(self):
        client = Client()
        client.force_login(self.staff)
        response = client.get(reverse('api_rbac_overview'))
        self.assertEqual(response.status_code, 403)

    def test_staff_cannot_send_test_email(self):
        client = Client()
        client.force_login(self.staff)
        response = client.post(
            reverse('api_system_settings_test_email'),
            data=json.dumps({'recipient_email': 'blocked@example.com'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_staff_cannot_view_dashboard_overview(self):
        client = Client()
        client.force_login(self.staff)
        response = client.get(reverse('api_dashboard_overview'))
        self.assertEqual(response.status_code, 403)

    def test_staff_cannot_reset_other_user_password(self):
        target = User.objects.create_user(
            username='reset-target',
            email='reset-target@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
        )
        client = Client()
        client.force_login(self.staff)
        response = client.post(
            reverse('api_users_reset_password', args=[target.id]),
            data=json.dumps({'new_password': 'AnotherPass2'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_staff_cannot_reactivate_other_user(self):
        target = User.objects.create_user(
            username='inactive-target',
            email='inactive-target@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
            is_active=False,
        )
        client = Client()
        client.force_login(self.staff)
        response = client.post(
            reverse('api_users_reactivate', args=[target.id]),
            data=json.dumps({}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)


class PasswordManagementApiTests(TestCase):
    def setUp(self):
        seed_rbac_defaults()
        self.staff = User.objects.create_user(
            username='pw-staff',
            email='pw-staff@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
        )

    def test_user_can_change_own_password(self):
        client = Client()
        client.force_login(self.staff)

        response = client.post(
            reverse('api_session_change_password'),
            data=json.dumps({'current_password': 'StrongPass1', 'new_password': 'NewStrongPass2'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.check_password('NewStrongPass2'))
        self.assertFalse(self.staff.force_password_change)

    def test_change_password_rejects_invalid_current_password(self):
        client = Client()
        client.force_login(self.staff)

        response = client.post(
            reverse('api_session_change_password'),
            data=json.dumps({'current_password': 'WrongPass', 'new_password': 'NewStrongPass2'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)

    def test_archived_user_cannot_login(self):
        archived = User.objects.create_user(
            username='archived-user',
            email='archived-user@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
            is_active=True,
            is_archived=True,
        )

        response = self.client.post(
            reverse('api_session_login'),
            data=json.dumps({'username': archived.username, 'password': 'StrongPass1'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)


class NotificationAndAuditVisibilityTests(TestCase):
    def setUp(self):
        seed_rbac_defaults()

    def test_notifications_endpoint_does_not_seed_activity_logs(self):
        user = User.objects.create_user(
            username='notif-user',
            email='notif-user@example.com',
            password='StrongPass1',
            role=User.Role.ADMIN,
            is_staff=True,
        )
        client = Client()
        client.force_login(user)

        response = client.get(reverse('api_notifications_data'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['notifications'], [])
        self.assertEqual(payload['unread_count'], 0)

    def test_staff_notification_feed_filters_non_actionable_and_audit_items(self):
        staff = User.objects.create_user(
            username='notif-staff',
            email='notif-staff@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
        )
        NotificationReceipt.objects.create(
            user=staff,
            notification=Notification.objects.create(
                kind='system',
                title='Branding updated',
                message='Organization branding assets were updated.',
                href='/settings',
            ),
        )
        NotificationReceipt.objects.create(
            user=staff,
            notification=Notification.objects.create(
                kind='event',
                title='Request approved',
                message='REQ-101 approved.',
                href='/requests/abc',
            ),
        )
        NotificationReceipt.objects.create(
            user=staff,
            notification=Notification.objects.create(
                kind='event',
                title='Invitation response',
                message='Invitation status updated.',
                href='/invitations/xyz',
            ),
        )
        NotificationReceipt.objects.create(
            user=staff,
            notification=Notification.objects.create(
                kind='audit',
                title='Request approved',
                message='Audit style payload should not be visible to staff.',
                href='/requests/audit',
            ),
        )
        NotificationReceipt.objects.create(
            user=staff,
            notification=Notification.objects.create(
                kind='event',
                title='Overdue item',
                message='Should be hidden for staff.',
                href='/invitations/overdue',
            ),
        )

        client = Client()
        client.force_login(staff)
        response = client.get(reverse('api_notifications_data'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        titles = [item['title'] for item in payload['notifications']]
        self.assertIn('Request approved', titles)
        self.assertIn('Invitation response', titles)
        self.assertNotIn('Branding updated', titles)
        self.assertNotIn('Overdue item', titles)
        self.assertEqual(titles.count('Request approved'), 1)

    def test_auditor_cannot_view_activity_logs_even_if_permission_is_assigned(self):
        auditor = User.objects.create_user(
            username='audit-auditor',
            email='audit-auditor@example.com',
            password='StrongPass1',
            role=User.Role.AUDITOR,
            is_staff=True,
        )
        role_auditor = RoleDefinition.objects.get(key=User.Role.AUDITOR)
        perm_audit = Permission.objects.get(key='audit:view')
        RolePermission.objects.get_or_create(role=role_auditor, permission=perm_audit)

        client = Client()
        client.force_login(auditor)
        response = client.get(reverse('api_activity_logs_data'))
        self.assertEqual(response.status_code, 403)

    def test_director_can_view_activity_logs(self):
        director = User.objects.create_user(
            username='audit-director',
            email='audit-director@example.com',
            password='StrongPass1',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )
        AuditLog.objects.create(
            user=director,
            action_type=AuditLog.ActionType.VIEW,
            content_type='Request',
            object_id='REQ-1',
            description='Viewed request.',
        )
        client = Client()
        client.force_login(director)

        response = client.get(reverse('api_activity_logs_data'))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])


class DirectorAccessControlTests(TestCase):
    def setUp(self):
        seed_rbac_defaults()
        self.director = User.objects.create_user(
            username='director-access',
            email='director-access@example.com',
            password='StrongPass1',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )

    def test_director_cannot_view_user_management_data(self):
        client = Client()
        client.force_login(self.director)
        response = client.get(reverse('api_user_management_data'))
        self.assertEqual(response.status_code, 403)

    def test_director_cannot_view_rbac_permissions(self):
        client = Client()
        client.force_login(self.director)
        response = client.get(reverse('api_rbac_overview'))
        self.assertEqual(response.status_code, 403)


class CoreAdminApiTests(TestCase):
    def setUp(self):
        seed_rbac_defaults()
        self.admin = User.objects.create_user(
            username='admin-user',
            email='admin@example.com',
            password='StrongPass1',
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.director = User.objects.create_user(
            username='director-user',
            email='director@example.com',
            password='StrongPass1',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )

    def test_admin_can_create_user(self):
        client = Client()
        client.force_login(self.admin)

        response = client.post(
            reverse('api_users_create'),
            data=json.dumps({
                'username': 'new-user',
                'email': 'new@example.com',
                'full_name': 'New User',
                'role': User.Role.ADMIN,
                'department': 'Finance',
                'password': 'StrongPass1',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(User.objects.filter(username='new-user').exists())

    def test_admin_can_create_user_with_additional_roles(self):
        client = Client()
        client.force_login(self.admin)

        response = client.post(
            reverse('api_users_create'),
            data=json.dumps(
                {
                    'username': 'multi-role-user',
                    'email': 'multi@example.com',
                    'full_name': 'Multi Role',
                    'role': User.Role.STAFF,
                    'additional_roles': [User.Role.ADMIN],
                    'department': 'Operations',
                    'password': 'StrongPass1',
                }
            ),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        created = User.objects.get(username='multi-role-user')
        self.assertEqual(created.role, User.Role.STAFF)
        self.assertTrue(UserRole.objects.filter(user=created, role__key=User.Role.ADMIN).exists())

    def test_director_limit_counts_additional_role_assignments(self):
        role_director = RoleDefinition.objects.get(key=User.Role.DIRECTOR)
        staff_a = User.objects.create_user(
            username='staff-a',
            email='staff-a@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
            is_active=True,
        )
        staff_b = User.objects.create_user(
            username='staff-b',
            email='staff-b@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
            is_active=True,
        )
        UserRole.objects.create(user=staff_a, role=role_director, created_by=self.admin)
        UserRole.objects.create(user=staff_b, role=role_director, created_by=self.admin)

        client = Client()
        client.force_login(self.admin)
        response = client.post(
            reverse('api_users_create'),
            data=json.dumps(
                {
                    'username': 'staff-c',
                    'email': 'staff-c@example.com',
                    'full_name': 'Staff C',
                    'role': User.Role.STAFF,
                    'additional_roles': [User.Role.DIRECTOR],
                    'department': 'Operations',
                    'password': 'StrongPass1',
                }
            ),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('Maximum 3 active users are allowed for role director', response.json()['error'])

    def test_director_cannot_create_user(self):
        client = Client()
        client.force_login(self.director)

        response = client.post(
            reverse('api_users_create'),
            data=json.dumps({
                'username': 'blocked-user',
                'email': 'blocked@example.com',
                'full_name': 'Blocked User',
                'role': User.Role.ADMIN,
                'department': 'Finance',
                'password': 'StrongPass1',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)

    def test_admin_can_assign_director_role_on_update(self):
        client = Client()
        client.force_login(self.admin)

        staff_user = User.objects.create_user(
            username='staff-updatable',
            email='staff-updatable@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_active=True,
            is_staff=False,
        )

        response = client.patch(
            reverse('api_users_update', args=[staff_user.id]),
            data=json.dumps({'additional_roles': [User.Role.DIRECTOR]}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(UserRole.objects.filter(user=staff_user, role__key=User.Role.DIRECTOR).exists())

    def test_admin_can_reset_user_password_and_force_change(self):
        target = User.objects.create_user(
            username='managed-user',
            email='managed-user@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
        )
        client = Client()
        client.force_login(self.admin)

        response = client.post(
            reverse('api_users_reset_password', args=[target.id]),
            data=json.dumps({'new_password': 'AnotherPass2', 'force_password_change': True}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        target.refresh_from_db()
        self.assertTrue(target.check_password('AnotherPass2'))
        self.assertTrue(target.force_password_change)
        self.assertTrue(
            AuditLog.objects.filter(
                content_type='User',
                object_id=str(target.id),
                description__icontains='Reset password',
            ).exists()
        )

    def test_admin_can_deactivate_and_archive_user(self):
        target = User.objects.create_user(
            username='deactivate-user',
            email='deactivate-user@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
            is_active=True,
        )
        client = Client()
        client.force_login(self.admin)

        deactivate_response = client.post(
            reverse('api_users_deactivate', args=[target.id]),
            data=json.dumps({}),
            content_type='application/json',
        )
        self.assertEqual(deactivate_response.status_code, 200)

        archive_response = client.patch(
            reverse('api_users_update', args=[target.id]),
            data=json.dumps({'is_archived': True}),
            content_type='application/json',
        )
        self.assertEqual(archive_response.status_code, 200)

        target.refresh_from_db()
        self.assertFalse(target.is_active)
        self.assertTrue(target.is_archived)
        self.assertTrue(
            AuditLog.objects.filter(
                content_type='User',
                object_id=str(target.id),
                description__icontains='Archived user',
            ).exists()
        )

    def test_admin_can_reactivate_inactive_user(self):
        target = User.objects.create_user(
            username='reactivate-user',
            email='reactivate-user@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
            is_active=True,
        )
        client = Client()
        client.force_login(self.admin)

        deactivate_response = client.post(
            reverse('api_users_deactivate', args=[target.id]),
            data=json.dumps({}),
            content_type='application/json',
        )
        self.assertEqual(deactivate_response.status_code, 200)

        reactivate_response = client.post(
            reverse('api_users_reactivate', args=[target.id]),
            data=json.dumps({}),
            content_type='application/json',
        )
        self.assertEqual(reactivate_response.status_code, 200)

        target.refresh_from_db()
        self.assertTrue(target.is_active)
        self.assertFalse(target.is_archived)
        self.assertTrue(
            AuditLog.objects.filter(
                content_type='User',
                object_id=str(target.id),
                description__icontains='Deactivated user',
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                content_type='User',
                object_id=str(target.id),
                description__icontains='Activated user',
            ).exists()
        )

    def test_director_with_admin_role_can_reactivate_user(self):
        role_admin = RoleDefinition.objects.get(key=User.Role.ADMIN)
        UserRole.objects.create(user=self.director, role=role_admin, created_by=self.admin)

        target = User.objects.create_user(
            username='director-reactivate-target',
            email='director-reactivate-target@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
            is_active=False,
            is_archived=True,
        )
        client = Client()
        client.force_login(self.director)

        response = client.post(
            reverse('api_users_reactivate', args=[target.id]),
            data=json.dumps({}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        target.refresh_from_db()
        self.assertTrue(target.is_active)
        self.assertFalse(target.is_archived)

    def test_reactivate_user_drops_blocked_additional_role_when_limit_reached(self):
        other_admin = User.objects.create_user(
            username='other-admin-user',
            email='other-admin-user@example.com',
            password='StrongPass1',
            role=User.Role.ADMIN,
            is_staff=True,
            is_active=True,
        )
        self.assertTrue(other_admin.is_active)

        target = User.objects.create_user(
            username='reactivate-limited-user',
            email='reactivate-limited-user@example.com',
            password='StrongPass1',
            role=User.Role.IT_ADMIN,
            is_staff=True,
            is_active=False,
            is_archived=True,
        )
        role_admin = RoleDefinition.objects.get(key=User.Role.ADMIN)
        role_director = RoleDefinition.objects.get(key=User.Role.DIRECTOR)
        UserRole.objects.create(user=target, role=role_admin, created_by=self.admin)
        UserRole.objects.create(user=target, role=role_director, created_by=self.admin)

        client = Client()
        client.force_login(self.admin)
        response = client.post(
            reverse('api_users_reactivate', args=[target.id]),
            data=json.dumps({}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['success'])
        self.assertIn('Additional roles removed due to role limits', payload.get('message', ''))

        target.refresh_from_db()
        self.assertTrue(target.is_active)
        self.assertFalse(target.is_archived)
        role_keys = set(target.role_assignments.values_list('role__key', flat=True))
        self.assertNotIn(User.Role.ADMIN, role_keys)
        self.assertIn(User.Role.DIRECTOR, role_keys)
        self.assertTrue(
            AuditLog.objects.filter(
                content_type='User',
                object_id=str(target.id),
                description__icontains='Removed additional role',
            ).exists()
        )

    def test_admin_can_patch_system_settings(self):
        client = Client()
        client.force_login(self.admin)

        response = client.patch(
            reverse('api_system_settings_data'),
            data=json.dumps({
                'system_settings': {
                    'site_name': 'CTRMS PROD',
                    'email_notifications_enabled': False,
                    'event_reminder_1_day_enabled': True,
                },
                'organization_settings': {
                    'organization_name': 'CTRMS Institution',
                },
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['success'])
        self.assertEqual(payload['system_settings']['site_name'], 'CTRMS PROD')

    def test_admin_can_patch_smtp_and_sender_settings(self):
        client = Client()
        client.force_login(self.admin)

        response = client.patch(
            reverse('api_system_settings_data'),
            data=json.dumps({
                'system_settings': {
                    'smtp_host': 'smtp.example.org',
                    'smtp_port': 465,
                    'smtp_username': 'smtp-user',
                    'smtp_password': 'smtp-secret',
                    'smtp_use_tls': False,
                    'smtp_use_ssl': True,
                    'sender_name': 'CTRMS Notifications',
                    'sender_email': 'noreply@example.org',
                },
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()['system_settings']
        self.assertEqual(payload['smtp_host'], 'smtp.example.org')
        self.assertEqual(payload['smtp_port'], 465)
        self.assertEqual(payload['smtp_username'], 'smtp-user')
        self.assertTrue(payload['smtp_password_configured'])
        self.assertFalse(payload['smtp_use_tls'])
        self.assertTrue(payload['smtp_use_ssl'])
        self.assertEqual(payload['sender_name'], 'CTRMS Notifications')
        self.assertEqual(payload['sender_email'], 'noreply@example.org')

        system = SystemSettings.objects.first()
        self.assertIsNotNone(system)
        self.assertEqual(system.smtp_server, 'smtp.example.org')
        self.assertEqual(system.smtp_port, 465)
        self.assertEqual(system.smtp_username, 'smtp-user')
        self.assertEqual(system.smtp_password, 'smtp-secret')
        self.assertFalse(system.smtp_use_tls)
        self.assertTrue(system.smtp_use_ssl)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_admin_can_send_test_email(self):
        client = Client()
        client.force_login(self.admin)

        SystemSettings.objects.create(
            site_name='CTRMS',
            organization_name='CTRMS Org',
            organization_email='org@example.com',
            support_email='support@example.com',
            email_notifications_enabled=True,
            sender_name='CTRMS',
            sender_email='noreply@example.com',
        )

        response = client.post(
            reverse('api_system_settings_test_email'),
            data=json.dumps({'recipient_email': 'ops@example.com'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['ops@example.com'])

    def test_admin_cannot_approve_request_via_legacy_endpoint(self):
        role_admin = RoleDefinition.objects.get(key=User.Role.ADMIN)
        perm_approve = Permission.objects.get(key='request:approve')
        RolePermission.objects.get_or_create(role=role_admin, permission=perm_approve)

        req = Request.objects.create(
            applicant_name='Legacy Request',
            applicant_email='legacy@example.com',
            applicant_phone='0712345678',
            address='Nairobi',
            category=Request.Category.OTHER,
            description='Legacy endpoint authorization check',
            amount_requested=3000,
            created_by=self.admin,
        )

        client = Client()
        client.force_login(self.admin)
        response = client.post(
            reverse('approve_request_ajax'),
            data=json.dumps({'request_id': str(req.id), 'approved_amount': 1500, 'notes': 'Attempted'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)
        req.refresh_from_db()
        self.assertEqual(req.status, Request.Status.PENDING)
