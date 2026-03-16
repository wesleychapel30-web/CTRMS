import shutil
from datetime import timedelta
import os
import json

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from invitations.models import Invitation, InvitationAttachment
from invitations.services import send_due_invitation_reminders
from core.rbac_defaults import seed_rbac_defaults
from core.notifications import EmailLog
from core.models import NotificationReceipt
from common.models import SystemSettings


User = get_user_model()


class InvitationModelTests(TestCase):
    def test_upcoming_flag_is_true_for_event_within_next_week(self):
        invitation = Invitation.objects.create(
            inviting_organization='Org',
            event_title='Board Meeting',
            description='Monthly briefing',
            location='HQ',
            event_date=timezone.now() + timedelta(days=3),
            contact_person='Jane',
            contact_email='jane@example.com',
            contact_phone='12345',
        )

        self.assertTrue(invitation.is_upcoming)
        self.assertGreater(invitation.event_end_time, invitation.event_date)


class InvitationWorkflowTests(TestCase):
    def setUp(self):
        seed_rbac_defaults()
        self.media_root = os.path.join(os.getcwd(), 'test_media_invitations')
        shutil.rmtree(self.media_root, ignore_errors=True)
        os.makedirs(self.media_root, exist_ok=True)
        self.addCleanup(lambda: shutil.rmtree(self.media_root, ignore_errors=True))

    def test_director_can_upload_attachment_and_confirm_attendance(self):
        with override_settings(MEDIA_ROOT=self.media_root):
            director = User.objects.create_user(
                username='director2',
                password='StrongPass1',
                email='director2@example.com',
                role=User.Role.DIRECTOR,
                is_staff=True,
            )
            invitation = Invitation.objects.create(
                inviting_organization='Institution',
                event_title='Annual Forum',
                description='Official invitation',
                location='Main Hall',
                event_date=timezone.now() + timedelta(days=5),
                contact_person='Protocol Officer',
                contact_email='protocol@example.com',
                contact_phone='0700000000',
            )

            api_client = Client()
            api_client.force_login(director)

            upload_response = api_client.post(
                reverse('invitation-upload-attachment', args=[invitation.pk]),
                {
                    'attachment_type': 'Invitation Letter',
                    'file': SimpleUploadedFile('letter.pdf', b'%PDF-1.4 letter', content_type='application/pdf'),
                },
            )
            self.assertEqual(upload_response.status_code, 201)
            self.assertEqual(InvitationAttachment.objects.count(), 1)

            accept_response = api_client.post(
                reverse('invitation-accept-invitation', args=[invitation.pk]),
                {'notes': 'Accepted'},
            )
            self.assertEqual(accept_response.status_code, 200)

            confirm_response = api_client.post(
                reverse('invitation-confirm-attendance', args=[invitation.pk]),
            )
            self.assertEqual(confirm_response.status_code, 200)

            invitation.refresh_from_db()
            self.assertEqual(invitation.status, Invitation.Status.CONFIRMED_ATTENDANCE)

    def test_calendar_endpoint_returns_events_for_selected_month(self):
        admin_user = User.objects.create_user(
            username='calendar-admin',
            password='StrongPass1',
            email='calendar-admin@example.com',
            role=User.Role.ADMIN,
            is_staff=True,
        )
        event_date = timezone.now() + timedelta(days=4)
        invitation = Invitation.objects.create(
            inviting_organization='Calendar Org',
            event_title='Calendar Event',
            description='Calendar coverage',
            location='HQ',
            event_date=event_date,
            contact_person='Calendar Contact',
            contact_email='calendar@example.com',
            contact_phone='0700000000',
            created_by=admin_user,
        )

        client = Client()
        client.force_login(admin_user)
        response = client.get(
            reverse('invitation-calendar'),
            {
                'year': event_date.year,
                'month': event_date.month,
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(any(item['id'] == str(invitation.id) for item in payload))

    def test_staff_cannot_create_invitation(self):
        staff = User.objects.create_user(
            username='invitation-staff-blocked',
            password='StrongPass1',
            email='invitation-staff-blocked@example.com',
            role=User.Role.STAFF,
            is_staff=False,
        )
        client = Client()
        client.force_login(staff)
        response = client.post(
            reverse('invitation-list'),
            data=json.dumps({
                'inviting_organization': 'Blocked Org',
                'event_title': 'Blocked Event',
                'description': 'Should not be allowed',
                'location': 'HQ',
                'event_date': (timezone.now() + timedelta(days=5)).isoformat(),
                'contact_person': 'Contact Person',
                'contact_email': 'contact@example.com',
                'contact_phone': '0700000000',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)

    def test_invitation_status_actions_emit_in_app_notifications(self):
        owner = User.objects.create_user(
            username='inv-owner',
            password='StrongPass1',
            email='inv-owner@example.com',
            role=User.Role.ADMIN,
            is_staff=True,
        )
        director = User.objects.create_user(
            username='inv-director',
            password='StrongPass1',
            email='inv-director@example.com',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )
        invitation = Invitation.objects.create(
            inviting_organization='Notify Org',
            event_title='Notify Event',
            description='Notification flow',
            location='HQ',
            event_date=timezone.now() + timedelta(days=3),
            contact_person='Notify Contact',
            contact_email='notify@example.com',
            contact_phone='0700000000',
            created_by=owner,
        )

        client = Client()
        client.force_login(director)

        accept_response = client.post(
            reverse('invitation-accept-invitation', args=[invitation.pk]),
            {'notes': 'Accepted for schedule'},
        )
        self.assertEqual(accept_response.status_code, 200)

        owner_titles = set(
            NotificationReceipt.objects.filter(user=owner)
            .select_related('notification')
            .values_list('notification__title', flat=True)
        )
        self.assertIn('Invitation response', owner_titles)

    def test_status_transition_rules_are_enforced(self):
        director = User.objects.create_user(
            username='transition-director',
            password='StrongPass1',
            email='transition-director@example.com',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )
        invitation = Invitation.objects.create(
            inviting_organization='Transition Org',
            event_title='Transition Event',
            description='Transition validation',
            location='HQ',
            event_date=timezone.now() + timedelta(days=4),
            contact_person='Transition Contact',
            contact_email='transition@example.com',
            contact_phone='0700000000',
        )

        client = Client()
        client.force_login(director)

        # Pending Review -> Accepted (allowed)
        accept_response = client.post(
            reverse('invitation-accept-invitation', args=[invitation.pk]),
            {'notes': 'Accepted'},
        )
        self.assertEqual(accept_response.status_code, 200)

        # Accepted -> Declined (not allowed)
        decline_after_accept = client.post(
            reverse('invitation-decline-invitation', args=[invitation.pk]),
            {'reason': 'Contradictory decision'},
        )
        self.assertEqual(decline_after_accept.status_code, 400)

        # Accepted -> Confirmed Attendance (allowed)
        confirm_response = client.post(
            reverse('invitation-confirm-attendance', args=[invitation.pk]),
        )
        self.assertEqual(confirm_response.status_code, 200)

        # Confirmed Attendance -> Completed (allowed)
        complete_response = client.post(
            reverse('invitation-mark-completed', args=[invitation.pk]),
        )
        self.assertEqual(complete_response.status_code, 200)

        # Completed -> Accept (not allowed)
        accept_after_confirm = client.post(
            reverse('invitation-accept-invitation', args=[invitation.pk]),
            {'notes': 'Retry accept'},
        )
        self.assertEqual(accept_after_confirm.status_code, 400)

    def test_cannot_confirm_attendance_before_accepting(self):
        director = User.objects.create_user(
            username='confirm-director',
            password='StrongPass1',
            email='confirm-director@example.com',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )
        invitation = Invitation.objects.create(
            inviting_organization='Confirm Org',
            event_title='Confirm Event',
            description='Confirm validation',
            location='HQ',
            event_date=timezone.now() + timedelta(days=4),
            contact_person='Confirm Contact',
            contact_email='confirm@example.com',
            contact_phone='0700000000',
            status=Invitation.Status.PENDING_REVIEW,
        )

        client = Client()
        client.force_login(director)
        response = client.post(reverse('invitation-confirm-attendance', args=[invitation.pk]))
        self.assertEqual(response.status_code, 400)

    def test_cannot_mark_completed_before_confirmation(self):
        director = User.objects.create_user(
            username='complete-director',
            password='StrongPass1',
            email='complete-director@example.com',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )
        invitation = Invitation.objects.create(
            inviting_organization='Complete Org',
            event_title='Complete Event',
            description='Completion validation',
            location='HQ',
            event_date=timezone.now() + timedelta(days=4),
            contact_person='Complete Contact',
            contact_email='complete@example.com',
            contact_phone='0700000000',
            status=Invitation.Status.ACCEPTED,
        )

        client = Client()
        client.force_login(director)
        response = client.post(reverse('invitation-mark-completed', args=[invitation.pk]))
        self.assertEqual(response.status_code, 400)

    def test_revert_decision_transitions(self):
        director = User.objects.create_user(
            username='revert-director',
            password='StrongPass1',
            email='revert-director@example.com',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )
        invitation = Invitation.objects.create(
            inviting_organization='Revert Org',
            event_title='Revert Event',
            description='Revert flow coverage',
            location='HQ',
            event_date=timezone.now() + timedelta(days=4),
            contact_person='Revert Contact',
            contact_email='revert@example.com',
            contact_phone='0700000000',
        )

        client = Client()
        client.force_login(director)

        # Pending -> Accepted
        self.assertEqual(
            client.post(
                reverse('invitation-accept-invitation', args=[invitation.pk]),
                {'notes': 'Accepted'},
            ).status_code,
            200,
        )

        # Accepted -> Pending Review (revert)
        revert_to_pending = client.post(
            reverse('invitation-revert-decision', args=[invitation.pk]),
            {'reason': 'Need additional review'},
        )
        self.assertEqual(revert_to_pending.status_code, 200)
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, Invitation.Status.PENDING_REVIEW)

        # Pending -> Declined
        self.assertEqual(
            client.post(
                reverse('invitation-decline-invitation', args=[invitation.pk]),
                {'reason': 'Scheduling issue'},
            ).status_code,
            200,
        )

        # Declined -> Pending Review (revert)
        revert_declined = client.post(
            reverse('invitation-revert-decision', args=[invitation.pk]),
            {'reason': 'Reconsider decision'},
        )
        self.assertEqual(revert_declined.status_code, 200)
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, Invitation.Status.PENDING_REVIEW)

        # Pending -> Accepted -> Confirmed Attendance
        self.assertEqual(
            client.post(
                reverse('invitation-accept-invitation', args=[invitation.pk]),
                {'notes': 'Accepted again'},
            ).status_code,
            200,
        )
        self.assertEqual(
            client.post(reverse('invitation-confirm-attendance', args=[invitation.pk])).status_code,
            200,
        )

        # Confirmed Attendance -> Accepted (revert)
        revert_confirmed = client.post(
            reverse('invitation-revert-decision', args=[invitation.pk]),
            {'reason': 'Attendance confirmation changed'},
        )
        self.assertEqual(revert_confirmed.status_code, 200)
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, Invitation.Status.ACCEPTED)

    def test_staff_cannot_revert_invitation_decision(self):
        staff = User.objects.create_user(
            username='revert-staff',
            password='StrongPass1',
            email='revert-staff@example.com',
            role=User.Role.STAFF,
            is_staff=False,
        )
        invitation = Invitation.objects.create(
            inviting_organization='Blocked Revert Org',
            event_title='Blocked Revert Event',
            description='Staff should be blocked from revert',
            location='HQ',
            event_date=timezone.now() + timedelta(days=4),
            contact_person='Blocked Contact',
            contact_email='blocked@example.com',
            contact_phone='0700000000',
            status=Invitation.Status.ACCEPTED,
        )

        client = Client()
        client.force_login(staff)
        response = client.post(reverse('invitation-revert-decision', args=[invitation.pk]), {'reason': 'Blocked'})
        self.assertEqual(response.status_code, 403)


@override_settings(
    ALLOWED_HOSTS=['testserver', 'localhost', '127.0.0.1', '192.168.1.140'],
    CORS_ALLOWED_ORIGINS=['http://localhost:5173', 'http://192.168.1.140:5173'],
    CSRF_TRUSTED_ORIGINS=['http://localhost:5173', 'http://192.168.1.140:5173'],
)
class InvitationCsrfIntegrationTests(TestCase):
    def setUp(self):
        seed_rbac_defaults()
        self.user = User.objects.create_user(
            username='invitation-admin',
            password='StrongPass1',
            email='invitation-admin@example.com',
            role=User.Role.ADMIN,
            is_staff=True,
        )

    def _invitation_payload(self, organization, event_title, description):
        return json.dumps({
            'inviting_organization': organization,
            'event_title': event_title,
            'description': description,
            'location': 'HQ',
            'event_date': (timezone.now() + timedelta(days=5)).isoformat(),
            'event_duration_hours': 2,
            'contact_person': 'Contact Person',
            'contact_email': 'contact@example.com',
            'contact_phone': '0700000000',
        })

    def test_invitation_create_allows_trusted_vite_origin(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user)
        session_response = client.get(reverse('api_session_status'))
        csrf_token = session_response.cookies.get('csrftoken').value

        response = client.post(
            reverse('invitation-list'),
            data=self._invitation_payload(
                organization='Trusted Org',
                event_title='Trusted Event',
                description='CSRF trusted origin test',
            ),
            content_type='application/json',
            HTTP_ORIGIN='http://192.168.1.140:5173',
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 201)

    def test_invitation_create_blocks_untrusted_origin(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user)
        session_response = client.get(reverse('api_session_status'))
        csrf_token = session_response.cookies.get('csrftoken').value

        response = client.post(
            reverse('invitation-list'),
            data=self._invitation_payload(
                organization='Untrusted Org',
                event_title='Blocked Event',
                description='CSRF untrusted origin test',
            ),
            content_type='application/json',
            HTTP_ORIGIN='http://evil.example:5173',
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 403)


class InvitationReminderEmailTests(TestCase):
    def setUp(self):
        seed_rbac_defaults()
        SystemSettings.objects.create(
            site_name='CTRMS',
            organization_name='CTRMS Org',
            organization_email='org@example.com',
            support_email='support@example.com',
            email_notifications_enabled=True,
            event_reminder_3_days_enabled=True,
            event_reminder_1_day_enabled=False,
        )

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_due_reminder_sends_email_and_records_log(self):
        invitation = Invitation.objects.create(
            inviting_organization='Reminder Org',
            event_title='Reminder Event',
            description='Reminder coverage',
            location='HQ',
            event_date=timezone.now() + timedelta(days=2),
            contact_person='Reminder Contact',
            contact_email='reminder@example.com',
            contact_phone='0700000000',
        )

        payload = send_due_invitation_reminders(reminder_type='3_days')
        invitation.refresh_from_db()

        self.assertEqual(payload['3_day_reminders'], 1)
        self.assertTrue(invitation.reminder_3_days_sent)
        self.assertTrue(
            EmailLog.objects.filter(
                recipient='reminder@example.com',
                template_type='EVENT_REMINDER',
                status='SENT',
            ).exists()
        )
